import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { NodeFsSourceTreeReader } from "../../../../../app/modules/shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";

function relativePosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

let tempDirectory: string | null = null;

afterEach(() => {
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

describe("NodeFsSourceTreeReader", () => {
  it("lists directories in stable order", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "Beta"));
    mkdirSync(path.join(tempDirectory, "Alpha"));
    writeFileSync(path.join(tempDirectory, "readme.md"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.listDirectories(tempDirectory).map((entry) => path.basename(entry))).toEqual(["Alpha", "Beta"]);
  });

  it("returns an empty list when directories cannot be read", () => {
    const reader = new NodeFsSourceTreeReader();

    expect(reader.listDirectories(path.join(os.tmpdir(), "missing-architecture-directory"))).toEqual([]);
  });

  it("walks files by extension recursively", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "Module", "domain"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "Module", "domain", "Thing.ts"), "");
    writeFileSync(path.join(tempDirectory, "Module", "domain", "Thing.md"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.walkFiles(tempDirectory, [".ts"]).map((entry) => relativePosix(tempDirectory!, entry))).toEqual([
      "Module/domain/Thing.ts",
    ]);
  });

  it("includes a file when it matches any of several extensions", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "Module"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "Module", "b.php"), "");
    writeFileSync(path.join(tempDirectory, "Module", "a.inc"), "");
    writeFileSync(path.join(tempDirectory, "Module", "c.txt"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.walkFiles(tempDirectory, [".php", ".inc"]).map((entry) => relativePosix(tempDirectory!, entry))).toEqual([
      "Module/a.inc",
      "Module/b.php",
    ]);
  });

  it("matches extensions by suffix so composite extensions like .lib.inc work", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "legacy"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "legacy", "helpers.lib.inc"), "");
    writeFileSync(path.join(tempDirectory, "legacy", "config.inc"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.walkFiles(tempDirectory, [".lib.inc"]).map((entry) => relativePosix(tempDirectory!, entry))).toEqual([
      "legacy/helpers.lib.inc",
    ]);
    expect(reader.walkFiles(tempDirectory, [".inc"]).map((entry) => relativePosix(tempDirectory!, entry))).toEqual([
      "legacy/config.inc",
      "legacy/helpers.lib.inc",
    ]);
  });

  it("excludes files whose relative path matches an ignored glob", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "Module"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "Module", "Service.php"), "");
    writeFileSync(path.join(tempDirectory, "Module", "Service.test.php"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(
      reader.walkFiles(tempDirectory, [".php"], ["**/*.test.php"]).map((entry) => relativePosix(tempDirectory!, entry)),
    ).toEqual(["Module/Service.php"]);
  });

  it("matches dotfiles against wildcards in ignore patterns", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    writeFileSync(path.join(tempDirectory, ".hidden.php"), "");
    writeFileSync(path.join(tempDirectory, "visible.php"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(
      reader.walkFiles(tempDirectory, [".php"], ["*.hidden.php"]).map((entry) => relativePosix(tempDirectory!, entry)),
    ).toEqual(["visible.php"]);
  });

  it("matches ignore globs against the full posix relative path, not the basename", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "Module", "sub"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "Module", "sub", "Excluded.php"), "");
    writeFileSync(path.join(tempDirectory, "Module", "Kept.php"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(
      reader.walkFiles(tempDirectory, [".php"], ["Module/sub/**"]).map((entry) => relativePosix(tempDirectory!, entry)),
    ).toEqual(["Module/Kept.php"]);
  });

  it("prunes ignored directories with both `**/vendor` and `**/vendor/**` patterns", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "vendor", "pkg"), { recursive: true });
    mkdirSync(path.join(tempDirectory, "src"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "vendor", "pkg", "Lib.php"), "");
    writeFileSync(path.join(tempDirectory, "src", "App.php"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(
      reader.walkFiles(tempDirectory, [".php"], ["**/vendor/**"]).map((entry) => relativePosix(tempDirectory!, entry)),
    ).toEqual(["src/App.php"]);
    expect(
      reader.walkFiles(tempDirectory, [".php"], ["**/vendor"]).map((entry) => relativePosix(tempDirectory!, entry)),
    ).toEqual(["src/App.php"]);
  });

  it("treats an empty ignoredPaths list the same as not passing one", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    mkdirSync(path.join(tempDirectory, "src"), { recursive: true });
    writeFileSync(path.join(tempDirectory, "src", "App.php"), "");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.walkFiles(tempDirectory, [".php"], []).map((entry) => relativePosix(tempDirectory!, entry))).toEqual([
      "src/App.php",
    ]);
  });

  it("reads text from a file", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    const file = path.join(tempDirectory, "note.txt");
    writeFileSync(file, "hello");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.readText(file)).toBe("hello");
  });

  it("reports isFile as false for directories and missing paths", () => {
    tempDirectory = mkdtempSync(path.join(os.tmpdir(), "architecture-fs-"));
    const file = path.join(tempDirectory, "note.txt");
    writeFileSync(file, "hello");

    const reader = new NodeFsSourceTreeReader();

    expect(reader.isFile(file)).toBe(true);
    expect(reader.isFile(tempDirectory)).toBe(false);
    expect(reader.isFile(path.join(tempDirectory, "missing.txt"))).toBe(false);
  });
});
