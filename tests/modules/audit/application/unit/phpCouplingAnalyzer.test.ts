import { describe, expect, it } from "vitest";

import type { PhpFileStructure, PhpMethodStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpCouplingAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpCouplingAnalyzer.js";

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

describe("phpCouplingAnalyzer", () => {
  it("no genera findings para un metodo dentro de los umbrales por defecto y sin singleton/global", () => {
    const file = buildFile({ functions: [buildMethod()] });

    expect(phpCouplingAnalyzer([file])).toEqual([]);
  });

  it("genera direct-instantiation cuando excede el umbral de instanciaciones directas", () => {
    const file = buildFile({ functions: [buildMethod({ directInstantiationsCount: 4 })] });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "coupling_low_level",
      rule: "direct-instantiation",
      severity: "medium",
      source: "native",
      module: "",
      class: null,
      file: "Foo.php",
      line: 10,
      details: { directInstantiationsCount: 4 },
      message: "Metodo con 4 instanciaciones directas, supera el umbral configurado.",
    });
  });

  it("no genera direct-instantiation cuando esta exactamente en el umbral", () => {
    const file = buildFile({ functions: [buildMethod({ directInstantiationsCount: 3 })] });

    expect(phpCouplingAnalyzer([file])).toEqual([]);
  });

  it("genera static-coupling cuando excede el umbral de llamadas estaticas", () => {
    const file = buildFile({ functions: [buildMethod({ staticCallsCount: 4 })] });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "static-coupling",
      severity: "medium",
      details: { staticCallsCount: 4 },
      message: "Metodo con 4 llamadas estaticas, supera el umbral configurado.",
    });
  });

  it("no genera static-coupling cuando esta exactamente en el umbral", () => {
    const file = buildFile({ functions: [buildMethod({ staticCallsCount: 3 })] });

    expect(phpCouplingAnalyzer([file])).toEqual([]);
  });

  it("genera singleton-dependency con una sola dependencia, sin umbral", () => {
    const file = buildFile({ functions: [buildMethod({ singletonAccessCount: 1 })] });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "singleton-dependency",
      severity: "medium",
      details: { singletonAccessCount: 1 },
      message: "Metodo depende de un singleton via ::getInstance().",
    });
  });

  it("genera global-state-access con un solo acceso, sin umbral", () => {
    const file = buildFile({ functions: [buildMethod({ globalAccessCount: 1 })] });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "global-state-access",
      severity: "medium",
      details: { globalAccessCount: 1 },
      message: "Metodo accede a estado global (global o variable superglobal).",
    });
  });

  it("un metodo que dispara las cuatro reglas genera cuatro findings independientes", () => {
    const file = buildFile({
      functions: [
        buildMethod({ directInstantiationsCount: 4, staticCallsCount: 4, singletonAccessCount: 1, globalAccessCount: 1 }),
      ],
    });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings.map((finding) => finding.rule)).toEqual([
      "direct-instantiation",
      "static-coupling",
      "singleton-dependency",
      "global-state-access",
    ]);
  });

  it("analiza metodos de clases ademas de funciones sueltas", () => {
    const file = buildFile({
      classes: [{ name: "Foo", startLine: 1, endLine: 5, extendsName: null, methods: [buildMethod({ singletonAccessCount: 1 })] }],
    });

    const findings = phpCouplingAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("singleton-dependency");
    expect(findings[0].class).toBe("Foo");
  });

  it("acepta thresholds personalizados", () => {
    const file = buildFile({ functions: [buildMethod({ directInstantiationsCount: 2 })] });

    const findings = phpCouplingAnalyzer([file], { directInstantiations: 1, staticCalls: 3 });

    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("direct-instantiation");
  });

  it("un archivo sin clases ni funciones no genera findings", () => {
    expect(phpCouplingAnalyzer([buildFile()])).toEqual([]);
  });

  it("agrega findings de varios archivos en un solo arreglo", () => {
    const fileA = buildFile({ file: "A.php", functions: [buildMethod({ singletonAccessCount: 1 })] });
    const fileB = buildFile({ file: "B.php", functions: [buildMethod({ singletonAccessCount: 1 })] });

    const findings = phpCouplingAnalyzer([fileA, fileB]);

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
  });
});
