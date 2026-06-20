import { describe, expect, it } from "vitest";

import type { AuditFinding } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { buildAuditSnapshot } from "../../../../../app/modules/audit/domain/services/auditSnapshotBuilder.js";

function buildFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    category: "architecture_violation",
    rule: "layer-violation",
    severity: "high",
    source: "architecture",
    module: "Users",
    class: null,
    file: "Users/Domain/User.php",
    line: 3,
    message: "irrelevante",
    details: {},
    ...overrides,
  };
}

describe("buildAuditSnapshot", () => {
  it("hereda target, module, filesScanned y modules del contexto", () => {
    const snapshot = buildAuditSnapshot([], { target: "laravel", module: "Users", filesScanned: 10, modules: 2 });

    expect(snapshot.target).toBe("laravel");
    expect(snapshot.module).toBe("Users");
    expect(snapshot.summary.files_scanned).toBe(10);
    expect(snapshot.summary.modules).toBe(2);
  });

  it("un arreglo vacio de findings produce summary y riskScore en cero", () => {
    const snapshot = buildAuditSnapshot([], { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.findings).toEqual([]);
    expect(snapshot.summary.findings_count).toBe(0);
    expect(snapshot.riskScore).toEqual({ value: 0, breakdown: {} });
  });

  it("pondera cada severidad: low=1, medium=2, high=3, critical=4", () => {
    const findings = [
      buildFinding({ category: "a", severity: "low" }),
      buildFinding({ category: "b", severity: "medium" }),
      buildFinding({ category: "c", severity: "high" }),
      buildFinding({ category: "d", severity: "critical" }),
    ];

    const snapshot = buildAuditSnapshot(findings, { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.riskScore.value).toBe(1 + 2 + 3 + 4);
    expect(snapshot.riskScore.breakdown).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });

  it("acumula el peso de varios findings de la misma categoria en breakdown", () => {
    const findings = [
      buildFinding({ category: "architecture_violation", severity: "high" }),
      buildFinding({ category: "architecture_violation", severity: "high" }),
    ];

    const snapshot = buildAuditSnapshot(findings, { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.riskScore.breakdown).toEqual({ architecture_violation: 6 });
  });

  it("agrega summary.by_category y summary.by_severity contando los findings", () => {
    const findings = [
      buildFinding({ category: "architecture_violation", severity: "high" }),
      buildFinding({ category: "coupling_module", severity: "medium" }),
      buildFinding({ category: "coupling_module", severity: "medium" }),
    ];

    const snapshot = buildAuditSnapshot(findings, { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.summary.findings_count).toBe(3);
    expect(snapshot.summary.by_category).toEqual({ architecture_violation: 1, coupling_module: 2 });
    expect(snapshot.summary.by_severity).toEqual({ high: 1, medium: 2 });
  });

  it("conserva los findings recibidos, en el mismo orden", () => {
    const findings = [buildFinding({ rule: "a" }), buildFinding({ rule: "b" })];

    const snapshot = buildAuditSnapshot(findings, { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.findings.map((finding) => finding.rule)).toEqual(["a", "b"]);
  });

  it("genera generatedAt en formato ISO", () => {
    const snapshot = buildAuditSnapshot([], { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("copia skippedFiles del contexto y refleja su conteo en summary.files_skipped", () => {
    const skippedFiles = [
      { file: "lib/Bad.php", error: "Parse Error : x" },
      { file: "lib/Bad2.php", error: "Parse Error : y" },
    ];

    const snapshot = buildAuditSnapshot([], { target: "laravel", module: null, filesScanned: 5, modules: 1, skippedFiles });

    expect(snapshot.skippedFiles).toEqual(skippedFiles);
    expect(snapshot.summary.files_skipped).toBe(2);
  });

  it("sin skippedFiles en el contexto, snapshot.skippedFiles es [] y files_skipped es 0", () => {
    const snapshot = buildAuditSnapshot([], { target: "laravel", module: null, filesScanned: 0, modules: 0 });

    expect(snapshot.skippedFiles).toEqual([]);
    expect(snapshot.summary.files_skipped).toBe(0);
  });
});
