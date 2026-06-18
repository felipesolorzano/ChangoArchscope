import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import { PhpAstParser } from "../../../../../app/modules/audit/infrastructure/parser/PhpAstParser.js";
import { scanPhpFiles } from "../../../../../app/modules/audit/application/use-cases/ScanPhpFiles.js";

function fakeReader(files: Record<string, string>): SourceTreeReader {
  return {
    listDirectories: () => [],
    walkFiles: (_directory, extensions) =>
      Object.keys(files).filter((file) => extensions.includes(file.slice(file.lastIndexOf(".")))),
    readText: (file) => files[file],
    isFile: (file) => file in files,
  };
}

const SOURCE_A = `<?php
function f($a) {
  echo $a;
}
`;

const SOURCE_B = `<?php
function g($a, $b) {
  return $a + $b;
}
`;

describe("scanPhpFiles", () => {
  it("escanea y parsea cada archivo .php encontrado bajo phpRoot", () => {
    const reader = fakeReader({ "/app/Foo.php": SOURCE_A, "/app/Bar.php": SOURCE_B });

    const structures = scanPhpFiles(reader, new PhpAstParser(), "/app");

    expect(structures.map((structure) => structure.file)).toEqual(["/app/Foo.php", "/app/Bar.php"]);
    expect(structures[0].functions[0]).toMatchObject({ name: "f", parametersCount: 1 });
    expect(structures[1].functions[0]).toMatchObject({ name: "g", parametersCount: 2 });
  });

  it("retorna un arreglo vacio cuando no hay archivos .php bajo phpRoot", () => {
    const reader = fakeReader({});

    expect(scanPhpFiles(reader, new PhpAstParser(), "/app")).toEqual([]);
  });

  it("pide a reader.walkFiles solo archivos .php", () => {
    let receivedExtensions: string[] = [];
    const reader: SourceTreeReader = {
      listDirectories: () => [],
      walkFiles: (_directory, extensions) => {
        receivedExtensions = extensions;
        return [];
      },
      readText: () => "",
      isFile: () => false,
    };

    scanPhpFiles(reader, new PhpAstParser(), "/app");

    expect(receivedExtensions).toEqual([".php"]);
  });
});
