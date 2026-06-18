import { describe, expect, it } from "vitest";

import type { PhpFileStructure } from "../../../../../app/modules/audit/domain/value-objects/PhpFileStructure.js";
import { phpSecurityAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpSecurityAnalyzer.js";

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

describe("phpSecurityAnalyzer", () => {
  it("convierte eval-usage en un finding critical", () => {
    const file = buildFile({ securityIssues: [{ rule: "eval-usage", line: 5 }] });

    const findings = phpSecurityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "security",
      rule: "eval-usage",
      severity: "critical",
      source: "native",
      module: "",
      file: "Foo.php",
      line: 5,
      details: {},
      message: "Uso de eval(): riesgo de ejecucion de codigo arbitrario.",
    });
  });

  it("convierte dynamic-include en un finding high", () => {
    const file = buildFile({ securityIssues: [{ rule: "dynamic-include", line: 3 }] });

    const findings = phpSecurityAnalyzer([file]);

    expect(findings[0]).toMatchObject({
      rule: "dynamic-include",
      severity: "high",
      message: "include/require con ruta dinamica: riesgo de inclusion de archivo no controlada.",
    });
  });

  it("convierte sql-concatenation en un finding high", () => {
    const file = buildFile({ securityIssues: [{ rule: "sql-concatenation", line: 7 }] });

    const findings = phpSecurityAnalyzer([file]);

    expect(findings[0]).toMatchObject({
      rule: "sql-concatenation",
      severity: "high",
      message: "Concatenacion de SQL con datos dinamicos: riesgo de inyeccion SQL.",
    });
  });

  it("convierte unsanitized-output en un finding medium", () => {
    const file = buildFile({ securityIssues: [{ rule: "unsanitized-output", line: 9 }] });

    const findings = phpSecurityAnalyzer([file]);

    expect(findings[0]).toMatchObject({
      rule: "unsanitized-output",
      severity: "medium",
      message: "Salida directa de input de usuario sin pasar por ninguna funcion: riesgo de XSS.",
    });
  });

  it("genera un finding independiente por cada securityIssue, en el mismo orden", () => {
    const file = buildFile({
      securityIssues: [
        { rule: "eval-usage", line: 1 },
        { rule: "dynamic-include", line: 2 },
        { rule: "sql-concatenation", line: 3 },
        { rule: "unsanitized-output", line: 4 },
      ],
    });

    const findings = phpSecurityAnalyzer([file]);

    expect(findings.map((finding) => finding.rule)).toEqual([
      "eval-usage",
      "dynamic-include",
      "sql-concatenation",
      "unsanitized-output",
    ]);
  });

  it("un archivo sin securityIssues no genera findings", () => {
    expect(phpSecurityAnalyzer([buildFile()])).toEqual([]);
  });

  it("agrega findings de varios archivos en un solo arreglo", () => {
    const fileA = buildFile({ file: "A.php", securityIssues: [{ rule: "eval-usage", line: 1 }] });
    const fileB = buildFile({ file: "B.php", securityIssues: [{ rule: "eval-usage", line: 1 }] });

    const findings = phpSecurityAnalyzer([fileA, fileB]);

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
  });
});
