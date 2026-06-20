import { describe, expect, it } from "vitest";

import type { AuditFinding } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { buildRiskBreakdown } from "../../../../../app/modules/audit/domain/services/auditRiskBreakdown.js";

function buildFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    category: "complexity",
    rule: "long-method",
    severity: "medium",
    source: "native",
    module: "",
    class: null,
    file: "app/Modules/Users/Application/UseCases/Foo.php",
    line: 5,
    message: "irrelevante",
    details: {},
    ...overrides,
  };
}

describe("buildRiskBreakdown", () => {
  it("un arreglo vacio de findings produce todas las listas vacias", () => {
    expect(buildRiskBreakdown([])).toEqual({ byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] });
  });

  it("byFile agrega value y byCategory de todos los findings de un mismo archivo", () => {
    const findings = [
      buildFinding({ file: "A.php", category: "complexity", severity: "medium" }),
      buildFinding({ file: "A.php", category: "security", severity: "high" }),
      buildFinding({ file: "B.php", category: "complexity", severity: "low" }),
    ];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byFile).toEqual([
      { key: "A.php", value: 5, byCategory: { complexity: 2, security: 3 }, bySeverity: { medium: 1, high: 1 }, findingsCount: 2 },
      { key: "B.php", value: 1, byCategory: { complexity: 1 }, bySeverity: { low: 1 }, findingsCount: 1 },
    ]);
  });

  it("byFile agrega bySeverity contando 1 por finding segun su severidad", () => {
    const findings = [
      buildFinding({ file: "A.php", severity: "high" }),
      buildFinding({ file: "A.php", severity: "high" }),
      buildFinding({ file: "A.php", severity: "low" }),
    ];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byFile[0].bySeverity).toEqual({ high: 2, low: 1 });
  });

  it("byFile esta ordenado de mayor a menor value", () => {
    const findings = [
      buildFinding({ file: "Low.php", severity: "low" }),
      buildFinding({ file: "High.php", severity: "critical" }),
      buildFinding({ file: "Medium.php", severity: "medium" }),
    ];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byFile.map((entry) => entry.key)).toEqual(["High.php", "Medium.php", "Low.php"]);
  });

  it("byClass usa file#class como clave, para no mezclar clases con el mismo nombre en archivos distintos", () => {
    const findings = [
      buildFinding({ file: "A.php", class: "Foo", severity: "high" }),
      buildFinding({ file: "B.php", class: "Foo", severity: "low" }),
    ];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byClass).toEqual([
      { key: "A.php#Foo", value: 3, byCategory: { complexity: 3 }, bySeverity: { high: 1 }, findingsCount: 1 },
      { key: "B.php#Foo", value: 1, byCategory: { complexity: 1 }, bySeverity: { low: 1 }, findingsCount: 1 },
    ]);
  });

  it("byClass ignora findings con class: null", () => {
    const findings = [buildFinding({ class: null })];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byClass).toEqual([]);
  });

  it("byModule usa finding.module cuando no es vacio", () => {
    const findings = [buildFinding({ module: "Users", severity: "high" })];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byModule).toEqual([{ key: "Users", value: 3, byCategory: { complexity: 3 }, bySeverity: { high: 1 }, findingsCount: 1 }]);
  });

  it("byModule deriva el modulo desde la ruta relativa a phpRoot cuando finding.module es vacio", () => {
    const findings = [buildFinding({ module: "", file: "/app/Modules/Users/Foo.php", severity: "medium" })];

    const breakdown = buildRiskBreakdown(findings, "/app/Modules");

    expect(breakdown.byModule).toEqual([{ key: "Users", value: 2, byCategory: { complexity: 2 }, bySeverity: { medium: 1 }, findingsCount: 1 }]);
  });

  it("byModule ignora un finding con module vacio cuando no se recibe phpRoot", () => {
    const findings = [buildFinding({ module: "", file: "/app/Modules/Users/Foo.php" })];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.byModule).toEqual([]);
  });

  it("agrupa dos findings del mismo modulo derivado bajo una sola entrada", () => {
    const findings = [
      buildFinding({ module: "", file: "/app/Modules/Users/Foo.php", severity: "low" }),
      buildFinding({ module: "", file: "/app/Modules/Users/Bar.php", severity: "low" }),
    ];

    const breakdown = buildRiskBreakdown(findings, "/app/Modules");

    expect(breakdown.byModule).toEqual([{ key: "Users", value: 2, byCategory: { complexity: 2 }, bySeverity: { low: 2 }, findingsCount: 2 }]);
  });

  it("topRiskiestFiles tiene como maximo 20 elementos, ordenados de mayor a menor value", () => {
    const findings = Array.from({ length: 25 }, (_, index) =>
      buildFinding({ file: `File${index}.php`, severity: index % 2 === 0 ? "high" : "low" }),
    );

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.topRiskiestFiles).toHaveLength(20);
    expect(breakdown.topRiskiestFiles[0].value).toBeGreaterThanOrEqual(breakdown.topRiskiestFiles[19].value);
    expect(breakdown.topRiskiestFiles).toEqual(breakdown.byFile.slice(0, 20));
  });

  it("topRiskiestFiles trae todos los archivos cuando hay menos de 20", () => {
    const findings = [buildFinding({ file: "A.php" }), buildFinding({ file: "B.php" })];

    const breakdown = buildRiskBreakdown(findings);

    expect(breakdown.topRiskiestFiles).toHaveLength(2);
  });
});
