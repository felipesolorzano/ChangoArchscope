import { describe, expect, it } from "vitest";

import type { PhpFileStructure, PhpMethodStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpComplexityAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpComplexityAnalyzer.js";

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

describe("phpComplexityAnalyzer", () => {
  it("no genera findings para un metodo dentro de los umbrales por defecto", () => {
    const file = buildFile({ functions: [buildMethod()] });

    expect(phpComplexityAnalyzer([file])).toEqual([]);
  });

  it("genera long-method cuando el metodo excede methodLines", () => {
    const file = buildFile({ functions: [buildMethod({ startLine: 1, endLine: 32 })] });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "complexity",
      rule: "long-method",
      severity: "medium",
      source: "native",
      file: "Foo.php",
      line: 1,
      module: "",
      class: null,
      details: { lines: 32 },
      message: "Metodo con 32 lineas, supera el umbral configurado.",
    });
  });

  it("no genera long-method cuando el metodo mide exactamente el umbral", () => {
    const file = buildFile({ functions: [buildMethod({ startLine: 1, endLine: 30 })] });

    expect(phpComplexityAnalyzer([file])).toEqual([]);
  });

  it("genera too-many-parameters cuando el metodo excede el umbral de parametros", () => {
    const file = buildFile({ functions: [buildMethod({ parametersCount: 6 })] });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "too-many-parameters",
      severity: "medium",
      details: { parametersCount: 6 },
      message: "Metodo con 6 parametros, supera el umbral configurado.",
    });
  });

  it("no genera too-many-parameters cuando el metodo tiene exactamente el umbral de parametros", () => {
    const file = buildFile({ functions: [buildMethod({ parametersCount: 5 })] });

    expect(phpComplexityAnalyzer([file])).toEqual([]);
  });

  it("genera high-cyclomatic-complexity cuando decisionPointsCount + 1 excede el umbral", () => {
    const file = buildFile({ functions: [buildMethod({ decisionPointsCount: 10 })] });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "high-cyclomatic-complexity",
      severity: "high",
      details: { cyclomaticComplexity: 11 },
      message: "Complejidad ciclomatica 11, supera el umbral configurado.",
    });
  });

  it("no genera high-cyclomatic-complexity cuando decisionPointsCount + 1 es exactamente el umbral", () => {
    const file = buildFile({ functions: [buildMethod({ decisionPointsCount: 9 })] });

    expect(phpComplexityAnalyzer([file])).toEqual([]);
  });

  it("un metodo que excede dos umbrales genera dos findings independientes", () => {
    const file = buildFile({ functions: [buildMethod({ parametersCount: 6, decisionPointsCount: 10 })] });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings.map((finding) => finding.rule)).toEqual(["too-many-parameters", "high-cyclomatic-complexity"]);
  });

  it("genera large-class cuando una clase excede classLines, independientemente de sus metodos", () => {
    const file = buildFile({
      classes: [{ name: "Foo", startLine: 1, endLine: 301, extendsName: null, methods: [buildMethod()] }],
    });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "large-class",
      severity: "medium",
      class: "Foo",
      details: { lines: 301 },
      message: "Clase con 301 lineas, supera el umbral configurado.",
    });
  });

  it("no genera large-class cuando la clase mide exactamente el umbral", () => {
    const file = buildFile({ classes: [{ name: "Foo", startLine: 1, endLine: 300, extendsName: null, methods: [] }] });

    expect(phpComplexityAnalyzer([file])).toEqual([]);
  });

  it("analiza metodos de clases ademas de funciones sueltas", () => {
    const file = buildFile({
      classes: [{ name: "Foo", startLine: 1, endLine: 5, extendsName: null, methods: [buildMethod({ parametersCount: 6 })] }],
    });

    const findings = phpComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("too-many-parameters");
    expect(findings[0].class).toBe("Foo");
  });

  it("acepta thresholds personalizados", () => {
    const file = buildFile({ functions: [buildMethod({ parametersCount: 3 })] });

    const findings = phpComplexityAnalyzer([file], { methodLines: 30, classLines: 300, parameters: 2, cyclomaticComplexity: 10 });

    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("too-many-parameters");
  });

  it("un archivo sin clases ni funciones no genera findings", () => {
    expect(phpComplexityAnalyzer([buildFile()])).toEqual([]);
  });

  it("agrega findings de varios archivos en un solo arreglo", () => {
    const fileA = buildFile({ file: "A.php", functions: [buildMethod({ parametersCount: 6 })] });
    const fileB = buildFile({ file: "B.php", functions: [buildMethod({ parametersCount: 6 })] });

    const findings = phpComplexityAnalyzer([fileA, fileB]);

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
  });
});
