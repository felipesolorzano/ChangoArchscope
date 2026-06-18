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
