import { describe, expect, it, vi } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { JsSourceParser } from "../../../../../app/modules/audit/domain/repositories/JsSourceParser.js";
import type { JsFileStructure } from "../../../../../app/modules/audit/domain/value-objects/JsFileStructure.js";
import { scanJsFiles } from "../../../../../app/modules/audit/application/use-cases/ScanJsFiles.js";

function fakeReader(files: Record<string, string>): SourceTreeReader {
  return {
    listDirectories: () => [],
    walkFiles: vi.fn(() => Object.keys(files)),
    readText: (file) => files[file],
    isFile: (file) => file in files,
  };
}

function structure(file: string, source: string): JsFileStructure {
  return {
    file,
    linesCount: source.length,
    classes: [],
    functions: [],
    imports: [],
    securityIssues: [],
    httpCalls: [],
    globalAccesses: [],
    legacyReactApis: [],
  };
}

const parser: JsSourceParser = {
  parse: (file, source) => {
    if (source === "BAD") {
      throw new Error(`Unexpected token in ${file}`);
    }
    return structure(file, source);
  },
};

describe("scanJsFiles", () => {
  it("recorre la raiz con extensiones e ignoredPaths y parsea cada archivo con su contenido", () => {
    const reader = fakeReader({ "/src/a.js": "aa", "/src/b.jsx": "bbb" });

    const result = scanJsFiles(reader, parser, "/src", [".js", ".jsx"], ["**/__tests__/**"]);

    expect(reader.walkFiles).toHaveBeenCalledWith("/src", [".js", ".jsx"], ["**/__tests__/**"]);
    expect(result.files).toEqual([structure("/src/a.js", "aa"), structure("/src/b.jsx", "bbb")]);
    expect(result.skipped).toEqual([]);
  });

  it("reporta en skipped los archivos que el parser no puede procesar, sin cortar el scan", () => {
    const reader = fakeReader({ "/src/ok.js": "ok", "/src/bad.js": "BAD", "/src/ok2.js": "ok2" });

    const result = scanJsFiles(reader, parser, "/src", [".js"], []);

    expect(result.files.map((file) => file.file)).toEqual(["/src/ok.js", "/src/ok2.js"]);
    expect(result.skipped).toEqual([{ file: "/src/bad.js", error: "Unexpected token in /src/bad.js" }]);
  });

  it("convierte a string un error que no es instancia de Error", () => {
    const reader = fakeReader({ "/src/x.js": "x" });
    const throwing: JsSourceParser = {
      parse: () => {
        throw "boom";
      },
    };

    expect(scanJsFiles(reader, throwing, "/src", [".js"], []).skipped).toEqual([{ file: "/src/x.js", error: "boom" }]);
  });
});
