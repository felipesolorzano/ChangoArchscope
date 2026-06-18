import { describe, expect, it } from "vitest";

import type { AuditFinding, AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { exceedsSeverityThreshold } from "../../../../../app/modules/audit/domain/services/auditSeverityUtils.js";

function buildFinding(severity: AuditFinding["severity"]): AuditFinding {
  return {
    category: "architecture_violation",
    rule: "layer-violation",
    severity,
    source: "architecture",
    module: "Users",
    class: null,
    file: "Users/Domain/User.php",
    line: 1,
    message: "irrelevante para este test",
    details: {},
  };
}

function buildSnapshot(findings: AuditFinding[]): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    summary: {
      files_scanned: 0,
      modules: 0,
      findings_count: findings.length,
      by_category: {},
      by_severity: {},
    },
    findings,
    riskScore: { value: 0, breakdown: {} },
    riskBreakdown: { byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] },
  };
}

describe("exceedsSeverityThreshold", () => {
  it("es true cuando hay un finding high y el umbral es high", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([buildFinding("high")]), "high")).toBe(true);
  });

  it("es true cuando hay un finding critical y el umbral es high", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([buildFinding("critical")]), "high")).toBe(true);
  });

  it("es false cuando todos los findings son low/medium y el umbral es high", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([buildFinding("low"), buildFinding("medium")]), "high")).toBe(false);
  });

  it("es true cuando hay un finding medium y el umbral es medium", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([buildFinding("medium")]), "medium")).toBe(true);
  });

  it("es false cuando no hay findings, sin importar el umbral", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([]), "low")).toBe(false);
  });

  it("es false cuando el unico finding es low y el umbral es medium", () => {
    expect(exceedsSeverityThreshold(buildSnapshot([buildFinding("low")]), "medium")).toBe(false);
  });
});
