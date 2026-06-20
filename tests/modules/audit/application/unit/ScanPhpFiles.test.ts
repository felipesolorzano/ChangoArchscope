import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
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

    const { files, skipped } = scanPhpFiles(reader, new PhpAstParser(), "/app");

    expect(files.map((structure) => structure.file)).toEqual(["/app/Foo.php", "/app/Bar.php"]);
    expect(files[0].functions[0]).toMatchObject({ name: "f", parametersCount: 1 });
    expect(files[1].functions[0]).toMatchObject({ name: "g", parametersCount: 2 });
    expect(skipped).toEqual([]);
  });

  it("retorna files y skipped vacios cuando no hay archivos .php bajo phpRoot", () => {
    const reader = fakeReader({});

    expect(scanPhpFiles(reader, new PhpAstParser(), "/app")).toEqual({ files: [], skipped: [] });
  });

  it("omite los archivos que el parser no puede procesar y los reporta en skipped, sin lanzar", () => {
    const reader = fakeReader({ "/app/Ok.php": SOURCE_A, "/app/Bad.php": "<?php ??? not php", "/app/Ok2.php": SOURCE_B });
    const parser: PhpSourceParser = {
      parse: (file, source) => {
        if (file === "/app/Bad.php") {
          throw new Error("Parse Error : syntax error on line 1");
        }
        return new PhpAstParser().parse(file, source);
      },
    };

    const { files, skipped } = scanPhpFiles(reader, parser, "/app");

    expect(files.map((structure) => structure.file)).toEqual(["/app/Ok.php", "/app/Ok2.php"]);
    expect(skipped).toEqual([{ file: "/app/Bad.php", error: "Parse Error : syntax error on line 1" }]);
  });

  it("pide a reader.walkFiles solo archivos .php por defecto, sin paths ignorados", () => {
    let receivedExtensions: string[] = [];
    let receivedIgnoredPaths: string[] | undefined;
    const reader: SourceTreeReader = {
      listDirectories: () => [],
      walkFiles: (_directory, extensions, ignoredPaths) => {
        receivedExtensions = extensions;
        receivedIgnoredPaths = ignoredPaths;
        return [];
      },
      readText: () => "",
      isFile: () => false,
    };

    scanPhpFiles(reader, new PhpAstParser(), "/app");

    expect(receivedExtensions).toEqual([".php"]);
    expect(receivedIgnoredPaths).toEqual([]);
  });

  it("reenvia las extensiones e ignoredPaths configurados a reader.walkFiles", () => {
    let receivedExtensions: string[] = [];
    let receivedIgnoredPaths: string[] | undefined;
    const reader: SourceTreeReader = {
      listDirectories: () => [],
      walkFiles: (_directory, extensions, ignoredPaths) => {
        receivedExtensions = extensions;
        receivedIgnoredPaths = ignoredPaths;
        return [];
      },
      readText: () => "",
      isFile: () => false,
    };

    scanPhpFiles(reader, new PhpAstParser(), "/app", [".php", ".inc", ".lib.inc"], ["**/vendor/**"]);

    expect(receivedExtensions).toEqual([".php", ".inc", ".lib.inc"]);
    expect(receivedIgnoredPaths).toEqual(["**/vendor/**"]);
  });
});
