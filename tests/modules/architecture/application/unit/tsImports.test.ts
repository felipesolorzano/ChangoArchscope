import { describe, expect, it } from "vitest";

import { tsImports } from "../../../../../app/modules/architecture/application/analyzers/tsImports.js";

const extract = (text: string) =>
  tsImports("/x.ts", { readText: () => text, listDirectories: () => [], walkFiles: () => [], isFile: () => false });

describe("tsImports", () => {
  it("import from (default, named, type, namespace) con su linea", () => {
    expect(
      extract('import React from "react";\nimport { a, b } from "./ab";\nimport type { T } from \'./types\';\nimport * as ns from "./ns";\n'),
    ).toEqual([
      { import: "react", line: 1 },
      { import: "./ab", line: 2 },
      { import: "./types", line: 3 },
      { import: "./ns", line: 4 },
    ]);
  });

  it("named imports en varias lineas: la linea es la del inicio de la sentencia", () => {
    expect(extract('\nimport {\n  a,\n  b,\n} from "./multi";\n')).toEqual([{ import: "./multi", line: 2 }]);
  });

  it("un import de efecto lateral no se traga el import siguiente", () => {
    expect(extract('import "./styles.css";\nimport { x } from "./x";\nimport \'./other.css\';\n')).toEqual([
      { import: "./styles.css", line: 1 },
      { import: "./x", line: 2 },
      { import: "./other.css", line: 3 },
    ]);
  });

  it("import() dinamico y require con string literal", () => {
    expect(extract('const a = import("./lazy");\nconst b = require("./legacy");\nconst c = require(\'./single\');\n')).toEqual([
      { import: "./lazy", line: 1 },
      { import: "./legacy", line: 2 },
      { import: "./single", line: 3 },
    ]);
  });

  it("require sin literal, metodos llamados require y palabras parecidas no cuentan", () => {
    expect(extract("require(name);\nobj.require('./x');\nconst required = 1;\nimportant('./y');\n")).toEqual([]);
  });

  it("tolera espacios de mas o de menos", () => {
    expect(
      extract('import  type  { T }  from  "a";\nimport x from"b";\nimport"c";\nconst d = import( "d" );\nconst e = require ( "e" );\nconst f = import(\n  "f"\n);\n'),
    ).toEqual([
      { import: "a", line: 1 },
      { import: "b", line: 2 },
      { import: "c", line: 3 },
      { import: "d", line: 4 },
      { import: "e", line: 5 },
      { import: "f", line: 6 },
    ]);
  });

  it("un archivo sin imports devuelve vacio", () => {
    expect(extract("const a = 1;\n")).toEqual([]);
  });
});
