import path from "node:path";

import { minimatch } from "minimatch";
import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { RuntimeProbe } from "../../../../../app/modules/dependencies/application/contracts/RuntimeProbe.js";
import { detectDependencies } from "../../../../../app/modules/dependencies/application/use-cases/detectDependencies.js";

// Filesystem en memoria: rutas absolutas → contenido; las carpetas se deducen de las rutas.
function memoryReader(files: Record<string, string>): SourceTreeReader {
  const ignoredBy = (root: string, file: string, patterns: string[]) => {
    const segments = path.relative(root, file).split(path.sep);
    // Igual que el lector real: un archivo se descarta si el o alguna carpeta que lo contiene coincide.
    return segments.some((_, index) => patterns.some((pattern) => minimatch(segments.slice(0, index + 1).join("/"), pattern, { dot: true })));
  };

  return {
    listDirectories: (dir) => [...new Set(Object.keys(files).filter((file) => file.startsWith(`${dir}/`)).map((file) => path.join(dir, path.relative(dir, file).split(path.sep)[0])))]
      .filter((entry) => !(entry in files))
      .sort(),
    walkFiles: (root, extensions, ignoredPaths = []) =>
      Object.keys(files)
        .filter((file) => file.startsWith(`${root}/`) && extensions.some((ext) => file.endsWith(ext)) && !ignoredBy(root, file, ignoredPaths))
        .sort(),
    readText: (file) => files[file],
    isFile: (file) => file in files,
  };
}

const probe: RuntimeProbe = { versionOf: (kind) => ({ php: "8.3.6", node: "23.6.0", npm: "10.9.2" })[kind] };
const pkg = (deps: Record<string, string>, extra: object = {}) => JSON.stringify({ dependencies: deps, ...extra });

describe("detectDependencies", () => {
  it("raiz sin manifiesto: sube al mas cercano y no pasa de la carpeta con .git", () => {
    const reader = memoryReader({
      "/b/.git/HEAD": "ref",
      "/b/package.json": pkg({ express: "^4.0.0" }),
      "/b/app/package.json": pkg({ react: "^16.13.1" }, { engines: { node: ">=14" } }),
      "/b/app/package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: { react: { version: "16.14.0" } } }),
      "/b/app/src/index.js": "",
    });

    const inventory = detectDependencies({ target: "react", root: "/b/app/src", ignoredPaths: [], reader, probe });

    expect(inventory.root).toBe("/b/app/src");
    expect(inventory.manifests).toEqual(["/b/app/package.json"]);
    expect(inventory.dependencies).toEqual([
      { ecosystem: "npm", name: "react", constraint: "^16.13.1", installed: "16.14.0", dev: false, manifest: "/b/app/package.json" },
    ]);
    expect(inventory.runtimes).toEqual([
      { kind: "node", version: "14.0.0", source: "package.json engines.node" },
      { kind: "npm", version: "10.9.2", source: "local" },
    ]);
    expect(inventory.skipped).toEqual([]);
  });

  it("con .git en la raiz no sube; los anidados aportan dependencias pero no definen el runtime", () => {
    const reader = memoryReader({
      "/package.json": pkg({ outside: "1.0.0" }),
      "/mc/.git/HEAD": "ref",
      "/mc/admin/reports-src/package.json": pkg({ chart: "^2.0.0" }, { engines: { node: ">=8" } }),
      "/mc/web/fat/composer.json": JSON.stringify({ require: { php: ">=5.3.6", "bcosca/fatfree": "^3.0" } }),
    });

    const inventory = detectDependencies({ target: "laravel", root: "/mc", ignoredPaths: [], reader, probe });

    expect(inventory.manifests).toEqual(["/mc/admin/reports-src/package.json", "/mc/web/fat/composer.json"]);
    expect(inventory.dependencies.map((dependency) => dependency.name)).toEqual(["chart", "bcosca/fatfree"]);
    expect(inventory.runtimes).toEqual([
      { kind: "php", version: "8.3.6", source: "local" },
      { kind: "node", version: "23.6.0", source: "local" },
      { kind: "npm", version: "10.9.2", source: "local" },
    ]);
  });

  it("cada tipo sube por separado: si la raiz tiene package.json solo se busca composer.json arriba", () => {
    const reader = memoryReader({
      "/package.json": pkg({ outside: "1.0.0" }),
      "/composer.json": JSON.stringify({ require: { "monolog/monolog": "^2.0" }, config: { platform: { php: "7.4.0" } } }),
      "/c/package.json": pkg({ react: "^18.0.0" }),
      "/c/.nvmrc": "v16.20.2",
    });

    const inventory = detectDependencies({ target: "react", root: "/c", ignoredPaths: [], reader, probe });

    expect(inventory.manifests).toEqual(["/c/package.json", "/composer.json"]);
    expect(inventory.runtimes).toEqual([
      { kind: "php", version: "7.4.0", source: "composer.json config.platform.php" },
      { kind: "node", version: "16.20.2", source: ".nvmrc" },
      { kind: "npm", version: "10.9.2", source: "local" },
    ]);
  });

  it("ordena los manifiestos: el principal de arriba puede ir antes que los anidados", () => {
    const reader = memoryReader({
      "/z/composer.json": JSON.stringify({ require: { "a/a": "^1.0" } }),
      "/z/r/sub/package.json": pkg({ b: "1.0.0" }),
      "/z/r/package.json": pkg({ c: "1.0.0" }),
    });

    expect(detectDependencies({ target: "react", root: "/z/r", ignoredPaths: [], reader, probe }).manifests).toEqual([
      "/z/composer.json",
      "/z/r/package.json",
      "/z/r/sub/package.json",
    ]);
  });

  it("toma .node-version si no hay .nvmrc", () => {
    const reader = memoryReader({ "/c/package.json": pkg({}), "/c/.node-version": "18.19.0" });

    expect(detectDependencies({ target: "react", root: "/c", ignoredPaths: [], reader, probe }).runtimes[0]).toEqual({
      kind: "node",
      version: "18.19.0",
      source: ".node-version",
    });
  });

  it("node_modules, vendor, ignoredPaths y nombres que no son exactos no aportan manifiestos", () => {
    const reader = memoryReader({
      "/r/.git/HEAD": "ref",
      "/r/package.json": pkg({ a: "1.0.0" }),
      "/r/node_modules/x/package.json": pkg({ b: "1.0.0" }),
      "/r/lib/vendor/y/composer.json": JSON.stringify({ require: { "c/c": "1.0" } }),
      "/r/legacy/package.json": pkg({ d: "1.0.0" }),
      "/r/tools/mypackage.json": pkg({ e: "1.0.0" }),
    });

    const inventory = detectDependencies({ target: "react", root: "/r", ignoredPaths: ["legacy/**"], reader, probe });

    expect(inventory.manifests).toEqual(["/r/package.json"]);
    expect(inventory.dependencies.map((dependency) => dependency.name)).toEqual(["a"]);
  });

  it("un manifiesto con JSON invalido se omite y queda en skipped", () => {
    const reader = memoryReader({ "/r/.git/HEAD": "", "/r/package.json": "{nope", "/r/sub/composer.json": JSON.stringify({ require: { "a/b": "^1.0" } }) });

    const inventory = detectDependencies({ target: "laravel", root: "/r", ignoredPaths: [], reader, probe });

    expect(inventory.manifests).toEqual(["/r/package.json", "/r/sub/composer.json"]);
    expect(inventory.dependencies.map((dependency) => dependency.name)).toEqual(["a/b"]);
    expect(inventory.skipped).toHaveLength(1);
    expect(inventory.skipped[0].manifest).toBe("/r/package.json");
    expect(inventory.skipped[0].reason).toMatch(/JSON/);
    expect(inventory.runtimes.map((runtime) => runtime.kind)).toEqual(["php", "node", "npm"]);
  });

  it("sin manifiestos: laravel pide php y react pide node/npm", () => {
    const reader = memoryReader({ "/e/.git/HEAD": "" });

    expect(detectDependencies({ target: "laravel", root: "/e", ignoredPaths: [], reader, probe }).runtimes.map((r) => r.kind)).toEqual(["php"]);
    expect(detectDependencies({ target: "react", root: "/e", ignoredPaths: [], reader, probe }).runtimes.map((r) => r.kind)).toEqual(["node", "npm"]);
  });

  it(".git como archivo (worktree) tambien detiene la subida", () => {
    const reader = memoryReader({ "/w/.git": "gitdir: x", "/w/package.json": pkg({ top: "1.0.0" }), "/w/app/src/a.js": "" });

    expect(detectDependencies({ target: "react", root: "/w/app/src", ignoredPaths: [], reader, probe }).manifests).toEqual(["/w/package.json"]);
    expect(detectDependencies({ target: "react", root: "/w/app", ignoredPaths: [], reader: memoryReader({ "/w/.git": "", "/package.json": "{}" }), probe }).manifests).toEqual([]);
  });
});
