import { describe, expect, it } from "vitest";

import type { PhpClassStructure, PhpFileStructure, PhpMethodStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpTestingAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpTestingAnalyzer.js";

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

describe("phpTestingAnalyzer", () => {
  it("genera untested-class para una clase de produccion sin evidencia de test", () => {
    const file = buildFile({ classes: [buildClass({ name: "UserService", startLine: 3 })] });

    const findings = phpTestingAnalyzer([file]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        category: "testing",
        rule: "untested-class",
        severity: "medium",
        source: "native",
        module: "",
        class: "UserService",
        file: "Foo.php",
        line: 3,
        details: { name: "UserService" },
      }),
    );
  });

  it("no genera untested-class cuando el nombre aparece en referencedNames de un archivo de test", () => {
    const production = buildFile({ file: "UserService.php", classes: [buildClass({ name: "UserService" })] });
    const test = buildFile({
      file: "UserServiceTest.php",
      classes: [buildClass({ name: "UserServiceTest", extendsName: "TestCase" })],
      referencedNames: ["UserService"],
    });

    const findings = phpTestingAnalyzer([production, test]);

    expect(findings.map((finding) => finding.rule)).not.toContain("untested-class");
  });

  it.each(["TestCase", "\\PHPUnit\\Framework\\TestCase"])(
    "una clase que extiende %s nunca genera findings, sin importar su complejidad",
    (extendsName) => {
      const file = buildFile({
        classes: [buildClass({ name: "FooTest", extendsName, methods: [buildMethod({ decisionPointsCount: 20 })] })],
      });

      expect(phpTestingAnalyzer([file])).toEqual([]);
    },
  );

  it("una clase que extiende algo distinto de TestCase no se trata como clase de test", () => {
    const file = buildFile({ classes: [buildClass({ name: "Foo", extendsName: "SomeBaseClass" })] });

    const findings = phpTestingAnalyzer([file]);

    expect(findings.map((finding) => finding.rule)).toContain("untested-class");
  });

  it("no incluye referencedNames de un archivo sin ninguna clase de test, aunque mencione otra clase", () => {
    const fileWithoutTest = buildFile({
      file: "Random.php",
      classes: [buildClass({ name: "Random" })],
      referencedNames: ["Ghost"],
    });
    const ghostFile = buildFile({ file: "Ghost.php", classes: [buildClass({ name: "Ghost" })] });

    const findings = phpTestingAnalyzer([fileWithoutTest, ghostFile]);

    expect(findings.map((finding) => finding.details.name)).toContain("Ghost");
  });

  it("incluye referencedNames de un archivo con al menos una clase de test, aunque tambien tenga una clase que no es de test", () => {
    const mixedFile = buildFile({
      file: "Mixed.php",
      classes: [buildClass({ name: "MixedTest", extendsName: "TestCase" }), buildClass({ name: "Helper" })],
      referencedNames: ["RealClass"],
    });
    const realClassFile = buildFile({ file: "RealClass.php", classes: [buildClass({ name: "RealClass" })] });

    const findings = phpTestingAnalyzer([mixedFile, realClassFile]);

    expect(findings.map((finding) => finding.details.name)).not.toContain("RealClass");
  });

  it("genera untested-complex-method por cada metodo con decisionPointsCount > 0 en una clase sin test", () => {
    const file = buildFile({
      classes: [
        buildClass({
          name: "UserService",
          methods: [
            buildMethod({ name: "simpleGetter", decisionPointsCount: 0 }),
            buildMethod({ name: "complexLogic", decisionPointsCount: 3, startLine: 15 }),
          ],
        }),
      ],
    });

    const findings = phpTestingAnalyzer([file]);

    expect(findings).toContainEqual(
      expect.objectContaining({
        category: "testing",
        rule: "untested-complex-method",
        severity: "high",
        source: "native",
        module: "",
        class: "UserService",
        file: "Foo.php",
        line: 15,
        details: { name: "UserService", method: "complexLogic" },
      }),
    );
    expect(findings.filter((finding) => finding.rule === "untested-complex-method")).toHaveLength(1);
  });

  it("no genera untested-complex-method para metodos triviales (decisionPointsCount === 0)", () => {
    const file = buildFile({
      classes: [buildClass({ name: "UserService", methods: [buildMethod({ decisionPointsCount: 0 })] })],
    });

    const findings = phpTestingAnalyzer([file]);

    expect(findings.map((finding) => finding.rule)).not.toContain("untested-complex-method");
  });

  it("no genera untested-complex-method cuando la clase si tiene evidencia de test, aunque tenga metodos complejos", () => {
    const production = buildFile({
      file: "UserService.php",
      classes: [buildClass({ name: "UserService", methods: [buildMethod({ decisionPointsCount: 5 })] })],
    });
    const test = buildFile({
      file: "UserServiceTest.php",
      classes: [buildClass({ name: "UserServiceTest", extendsName: "TestCase" })],
      referencedNames: ["UserService"],
    });

    const findings = phpTestingAnalyzer([production, test]);

    expect(findings).toEqual([]);
  });

  it("un archivo sin clases no genera findings", () => {
    expect(phpTestingAnalyzer([buildFile()])).toEqual([]);
  });

  it("agrega findings de varios archivos en un solo arreglo", () => {
    const fileA = buildFile({ file: "A.php", classes: [buildClass({ name: "Alpha" })] });
    const fileB = buildFile({ file: "B.php", classes: [buildClass({ name: "Beta" })] });

    const findings = phpTestingAnalyzer([fileA, fileB]).filter((finding) => finding.rule === "untested-class");

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
  });

  it("cada regla produce un mensaje legible", () => {
    const file = buildFile({
      classes: [buildClass({ name: "UserService", methods: [buildMethod({ decisionPointsCount: 2 })] })],
    });

    const findings = phpTestingAnalyzer([file]);

    expect(findings.find((finding) => finding.rule === "untested-class")?.message).toBe(
      'La clase "UserService" no tiene evidencia de test. Verificar antes de asumir que esta cubierta.',
    );
    expect(findings.find((finding) => finding.rule === "untested-complex-method")?.message).toBe(
      'El metodo "doStuff" de "UserService" tiene logica no trivial y la clase no tiene evidencia de test.',
    );
  });
});
