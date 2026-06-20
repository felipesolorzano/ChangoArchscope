import { describe, expect, it, vi } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import type { PlanTaskStateRepository } from "../../../../../app/modules/plan/application/contracts/PlanTaskStateRepository.js";
import { auditSnapshotToSignals } from "../../../../../app/modules/plan/application/services/auditSnapshotToSignals.js";
import { buildPlan } from "../../../../../app/modules/plan/application/use-cases/buildPlan.js";

function snapshot(): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    summary: {
      files_scanned: 10,
      files_skipped: 2,
      modules: 1,
      findings_count: 4,
      by_category: { security: 1, database: 3 },
      by_severity: { high: 2, medium: 2 },
    },
    findings: [
      { category: "security", rule: "sql-concatenation", severity: "high", source: "native", module: "", class: null, file: "/r/a/X.php", line: 1, message: "", details: {} },
      { category: "database", rule: "n-plus-one-query", severity: "high", source: "native", module: "", class: null, file: "/r/a/X.php", line: 2, message: "", details: {} },
    ],
    riskScore: { value: 9, breakdown: {} },
    riskBreakdown: {
      byFile: [
        { key: "/r/a/Trafic.lib.inc", value: 1, byCategory: {}, bySeverity: {}, findingsCount: 1 },
        { key: "/r/a/Trafic_new.lib.inc", value: 1, byCategory: {}, bySeverity: {}, findingsCount: 1 },
      ],
      byClass: [],
      byModule: [],
      topRiskiestFiles: [],
    },
    skippedFiles: [{ file: "x", error: "y" }, { file: "z", error: "w" }],
  };
}

function snapshotWith(over: { ruleOf?: string[]; fileKeys?: string[] }): AuditSnapshot {
  const base = snapshot();
  return {
    ...base,
    findings: (over.ruleOf ?? []).map((rule) => ({ ...base.findings[0], rule })),
    riskBreakdown: {
      ...base.riskBreakdown,
      byFile: (over.fileKeys ?? []).map((key) => ({ key, value: 1, byCategory: {}, bySeverity: {}, findingsCount: 1 })),
    },
  };
}

describe("auditSnapshotToSignals", () => {
  it("cuenta reglas, copia categorias, detecta pares _new y cuenta skipped", () => {
    const signals = auditSnapshotToSignals(snapshot());

    expect(signals.ruleCounts).toEqual({ "sql-concatenation": 1, "n-plus-one-query": 1 });
    expect(signals.categoryCounts).toEqual({ security: 1, database: 3 });
    expect(signals.duplicatePairs).toBe(1);
    expect(signals.skippedFiles).toBe(2);
  });

  it("acumula el conteo cuando una regla aparece varias veces", () => {
    const signals = auditSnapshotToSignals(snapshotWith({ ruleOf: ["dup", "dup", "other"] }));

    expect(signals.ruleCounts).toEqual({ dup: 2, other: 1 });
  });

  it("cuenta 0 pares cuando solo existe el _new (sin original) o la extension no coincide", () => {
    expect(auditSnapshotToSignals(snapshotWith({ fileKeys: ["/r/Trafic_new.lib.inc"] })).duplicatePairs).toBe(0);
    expect(
      auditSnapshotToSignals(snapshotWith({ fileKeys: ["/r/Trafic.lang.lib.inc", "/r/Trafic_new.lib.inc"] })).duplicatePairs,
    ).toBe(0);
  });

  it("cuenta el par cuando coinciden basename original y _new", () => {
    const signals = auditSnapshotToSignals(snapshotWith({ fileKeys: ["/a/Trafic.lib.inc", "/b/Trafic_new.lib.inc"] }));

    expect(signals.duplicatePairs).toBe(1);
  });
});

describe("buildPlan", () => {
  it("genera el grafo del plan con los estados del repositorio sobrepuestos", () => {
    const repository: PlanTaskStateRepository = {
      getStates: vi.fn(() => ({ "close-sql-injections": "done" })),
      setState: vi.fn(),
    };

    const graph = buildPlan(snapshot(), repository);

    expect(graph.nodes.find((node) => node.id === "close-sql-injections")?.state).toBe("done");
    // hay tareas derivadas (sql, n+1, third-party, validate)
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.some((node) => node.id === "resolve-duplicate-migrations")).toBe(true);
  });
});
