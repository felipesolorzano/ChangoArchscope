import { describe, expect, it } from "vitest";

import type { PhpClassStructure, PhpFileStructure, PhpMethodStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpDeadCodeAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpDeadCodeAnalyzer.js";

function buildMethod(overrides: Partial<PhpMethodStructure> = {}): PhpMethodStructure {
  return {
    name: "doStuff",
    startLine: 10,
    endLine: 12,
    parametersCount: 1,
    decisionPointsCount: 0,
    directInstantiationsCount: 0,
    staticCallsCount: 0,
    singletonAccessCount: 0,
    globalAccessCount: 0,
    ...overrides,
  };
}

function buildClass(overrides: Partial<PhpClassStructure> = {}): PhpClassStructure {
  return {
    name: "Foo",
    startLine: 1,
    endLine: 20,
    extendsName: null,
    methods: [],
    ...overrides,
  };
}

function buildFile(overrides: Partial<PhpFileStructure> = {}): PhpFileStructure {
  return {
    file: "Foo.php",
    classes: [],
    functions: [],
    referencedNames: [],
    securityIssues: [],
    sqlLiterals: [],
    ...overrides,
  };
}

describe("phpDeadCodeAnalyzer", () => {
  it("genera possibly-unused-function para una funcion que no aparece en ningun referencedNames", () => {
    const file = buildFile({ functions: [buildMethod({ name: "helper", startLine: 5 })] });

    const findings = phpDeadCodeAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "dead_code",
      rule: "possibly-unused-function",
      severity: "low",
      source: "native",
      module: "",
      class: null,
      file: "Foo.php",
      line: 5,
      details: { name: "helper" },
      message: 'La funcion "helper" no se referencia en los archivos escaneados. Verificar antes de eliminar.',
    });
  });

  it("no genera finding para una funcion referenciada en el mismo archivo", () => {
    const file = buildFile({ functions: [buildMethod({ name: "helper" })], referencedNames: ["helper"] });

    expect(phpDeadCodeAnalyzer([file])).toEqual([]);
  });

  it("no genera finding para una funcion referenciada desde otro archivo del conjunto", () => {
    const declared = buildFile({ file: "A.php", functions: [buildMethod({ name: "helper" })] });
    const caller = buildFile({ file: "B.php", referencedNames: ["helper"] });

    expect(phpDeadCodeAnalyzer([declared, caller])).toEqual([]);
  });

  it("genera possibly-unused-class para una clase nunca referenciada", () => {
    const file = buildFile({ classes: [buildClass({ name: "Foo", startLine: 1 })] });

    const findings = phpDeadCodeAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "possibly-unused-class",
      class: "Foo",
      details: { name: "Foo" },
      message: 'La clase "Foo" no se referencia en los archivos escaneados. Verificar antes de eliminar.',
    });
  });

  it("no genera finding para una clase referenciada (new, extends, type hint, etc.)", () => {
    const file = buildFile({ classes: [buildClass({ name: "Foo" })], referencedNames: ["Foo"] });

    expect(phpDeadCodeAnalyzer([file])).toEqual([]);
  });

  it("genera possibly-unused-method para un metodo nunca referenciado", () => {
    const file = buildFile({
      classes: [buildClass({ name: "Foo", methods: [buildMethod({ name: "process", startLine: 7 })] })],
      referencedNames: ["Foo"],
    });

    const findings = phpDeadCodeAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "possibly-unused-method",
      class: "Foo",
      details: { name: "process" },
      line: 7,
      message: 'El metodo "process" no se referencia en los archivos escaneados. Verificar antes de eliminar.',
    });
  });

  it("no genera finding para un metodo referenciado", () => {
    const file = buildFile({
      classes: [buildClass({ name: "Foo", methods: [buildMethod({ name: "process" })] })],
      referencedNames: ["Foo", "process"],
    });

    expect(phpDeadCodeAnalyzer([file])).toEqual([]);
  });

  it("nunca genera finding para metodos magicos, esten o no referenciados", () => {
    const file = buildFile({
      classes: [
        buildClass({
          name: "Foo",
          methods: [buildMethod({ name: "__construct" }), buildMethod({ name: "__toString" })],
        }),
      ],
      referencedNames: ["Foo"],
    });

    expect(phpDeadCodeAnalyzer([file])).toEqual([]);
  });

  it("un archivo sin clases ni funciones no genera findings", () => {
    expect(phpDeadCodeAnalyzer([buildFile()])).toEqual([]);
  });

  it("agrega findings de varios archivos en un solo arreglo", () => {
    const fileA = buildFile({ file: "A.php", functions: [buildMethod({ name: "helperA" })] });
    const fileB = buildFile({ file: "B.php", functions: [buildMethod({ name: "helperB" })] });

    const findings = phpDeadCodeAnalyzer([fileA, fileB]);

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
  });
});
