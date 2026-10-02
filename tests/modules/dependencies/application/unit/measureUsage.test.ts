import { describe, expect, it, vi } from "vitest";

import { measureUsage, usageKey } from "../../../../../app/modules/dependencies/application/use-cases/measureUsage.js";
import type { DeclaredDependency } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

const dep = (name: string, manifest = "/p/package.json", ecosystem: "npm" | "composer" = "npm", dev = false): DeclaredDependency => ({ ecosystem, name, constraint: "^1.0.0", installed: null, dev, manifest });

const files: Record<string, string> = {
  "/p/package.json": JSON.stringify({
    name: "p",
    scripts: { start: "react-scripts start" },
    dependencies: { react: "^18", write: "^1", "react-scripts": "^5" },
    devDependencies: { jest: "^29" },
    optionalDependencies: { "x-opt": "^1" },
    peerDependencies: { "x-peer": "^1" },
  }),
  "/p/composer.json": JSON.stringify({ require: { "a/b": "^1" } }),
  "/r/package.json": JSON.stringify({ dependencies: { lodash: "^4" } }),
  "/r/src/x.js": `import get from "lodash/get";`,
  "/p/src/a.js": `import React from "react";`,
  "/p/src/b.tsx": `import "react"; const w = "jest";`,
  "/q/package.json": "{nope",
};

function reader(): SourceTreeReader {
  return {
    listDirectories: () => [],
    walkFiles: vi.fn((root: string) => Object.keys(files).filter((file) => file.startsWith(`${root}/src/`))),
    readText: vi.fn((file: string) => files[file]),
    isFile: () => true,
  };
}

describe("measureUsage", () => {
  it("mide cada paquete npm con las fuentes de la carpeta de su manifiesto, leidas una vez", () => {
    const fs = reader();
    const usage = measureUsage({ dependencies: [dep("react"), dep("write"), dep("react-scripts"), dep("jest")], reader: fs });

    expect(usage.get(usageKey(dep("react")))).toEqual({ files: 2, inManifest: false, unused: false });
    expect(usage.get(usageKey(dep("write")))).toEqual({ files: 0, inManifest: false, unused: true });
    expect(usage.get(usageKey(dep("react-scripts")))).toEqual({ files: 0, inManifest: true, unused: false });
    expect(usage.get(usageKey(dep("jest")))).toEqual({ files: 1, inManifest: false, unused: false });
    expect(fs.walkFiles).toHaveBeenCalledTimes(1);
    expect(fs.walkFiles).toHaveBeenCalledWith("/p", [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"], ["**/node_modules", "**/vendor", "**/.*", "**/build", "**/dist", "**/coverage"]);
    expect((fs.readText as ReturnType<typeof vi.fn>).mock.calls.filter(([file]) => file === "/p/src/a.js")).toHaveLength(1);
  });

  it("cada manifiesto usa solo sus fuentes; las secciones de dependencias no cuentan como manifiesto", () => {
    const usage = measureUsage({
      dependencies: [dep("react"), dep("x-opt"), dep("x-peer"), dep("lodash", "/r/package.json"), dep("react", "/r/package.json")],
      reader: reader(),
    });

    expect(usage.get(usageKey(dep("react")))?.files).toBe(2);
    expect(usage.get(usageKey(dep("lodash", "/r/package.json")))?.files).toBe(1);
    expect(usage.get(usageKey(dep("react", "/r/package.json")))?.files).toBe(0);
    expect(usage.get(usageKey(dep("x-opt")))).toEqual({ files: 0, inManifest: false, unused: true });
    expect(usage.get(usageKey(dep("x-peer")))).toEqual({ files: 0, inManifest: false, unused: true });
  });

  it("un paquete de desarrollo sin referencias no se marca sin uso", () => {
    const usage = measureUsage({ dependencies: [dep("write", "/p/package.json", "npm", true)], reader: reader() });

    expect(usage.get(usageKey(dep("write")))).toEqual({ files: 0, inManifest: false, unused: false });
  });

  it("composer y manifiestos ilegibles quedan sin medir", () => {
    const usage = measureUsage({ dependencies: [dep("a/b", "/p/composer.json", "composer"), dep("x", "/q/package.json")], reader: reader() });

    expect(usage.size).toBe(0);
  });

  it("la llave une ecosistema, nombre y manifiesto", () => {
    expect(usageKey(dep("react"))).toBe("npm:react|/p/package.json");
  });
});
