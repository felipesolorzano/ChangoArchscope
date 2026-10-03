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
    scannedFiles: [],
    testedBy: {},
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

    expect(signals.findingCounts).toEqual({ "sql-concatenation": { high: 1 }, "n-plus-one-query": { high: 1 } });
    expect(signals.categoryCounts).toEqual({ security: 1, database: 3 });
    expect(signals.duplicatePairs).toBe(1);
    expect(signals.skippedFiles).toBe(2);
  });

  it("acumula el conteo cuando una regla aparece varias veces", () => {
    const signals = auditSnapshotToSignals(snapshotWith({ ruleOf: ["dup", "dup", "other"] }));

    expect(signals.findingCounts).toEqual({ dup: { high: 2 }, other: { high: 1 } });
  });

  it("separa el conteo de una regla por severidad", () => {
    const base = snapshot();
    const signals = auditSnapshotToSignals({
      ...base,
      findings: [
        { ...base.findings[0], rule: "untested-component", severity: "high" },
        { ...base.findings[0], rule: "untested-component", severity: "medium" },
        { ...base.findings[0], rule: "untested-component", severity: "medium" },
      ],
    });

    expect(signals.findingCounts).toEqual({ "untested-component": { high: 1, medium: 2 } });
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

describe("auditSnapshotToSignals: archivos riesgosos sin tests (XRay X6)", () => {
  const entry = (key: string, value: number) => ({ key, value, byCategory: {}, bySeverity: {}, findingsCount: 1 });
  const finding = (rule: string, file: string) => ({ ...snapshot().findings[0], rule, file });

  it("top 10 por riesgo (empate por ruta) de los escaneados, sin copias ni muertos, que no tienen tests", () => {
    const file = (index: number) => `/r/f${String(index).padStart(2, "0")}.php`;
    const base = snapshot();
    // Entrada desordenada: f02 y f01 empatan en 2 (gana f01 por ruta) en el puesto 10.
    const byFile = [entry(file(2), 2), entry(file(1), 2), entry(file(13), 13), entry(file(12), 12), ...[11, 10, 9, 8, 7, 6, 5, 4, 3].map((index) => entry(file(index), index)), entry(file(0), 1), entry(file(14), 0), entry("Arch.php", 999)];
    const signals = auditSnapshotToSignals({
      ...base,
      // f13 (copia) y f12 (sin uso) se excluyen; un hallazgo cualquiera (f10) no excluye; Arch.php no se escaneo.
      findings: [finding("manual-copy-file", file(13)), finding("possibly-unused-file", file(12)), finding("eval-usage", file(10))],
      riskBreakdown: { ...base.riskBreakdown, byFile },
      scannedFiles: Array.from({ length: 15 }, (_, index) => file(index)),
      // Con tests: f11 (en el top), f02 (pierde el empate), f00 (fuera del top) y los excluidos f13, f12 y Arch.php.
      testedBy: Object.fromEntries([file(11), file(2), file(0), file(13), file(12), "Arch.php"].map((key) => [key, ["/r/tests/T.php"]])),
    });

    // Top 10: f11, f10..f03, f01; con tests solo f11.
    expect(signals.topRiskUntested).toBe(9);
  });

  it("snapshot sin testedBy (cache viejo): todos sin tests", () => {
    const base = snapshot();
    const { testedBy: _omit, ...old } = { ...base, riskBreakdown: { ...base.riskBreakdown, byFile: [entry("/r/a.php", 3)] }, scannedFiles: ["/r/a.php"] };

    expect(auditSnapshotToSignals(old as AuditSnapshot).topRiskUntested).toBe(1);
  });
});

describe("buildPlan", () => {
  it("genera el grafo del plan con los estados del repositorio sobrepuestos", () => {
    const repository: PlanTaskStateRepository = {
      getStates: vi.fn(() => ({ "close-sql-injections": "done" })),
      setState: vi.fn(),
    };

    const graph = buildPlan(snapshot(), repository, "/php");

    expect(repository.getStates).toHaveBeenCalledWith("laravel", "/php");
    expect(graph.nodes.find((node) => node.id === "close-sql-injections")?.state).toBe("done");
    // hay tareas derivadas (sql, n+1, third-party, validate)
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.some((node) => node.id === "resolve-duplicate-migrations")).toBe(true);
  });

  it("agrega el checklist de categorias auditadas del stack con su conteo", () => {
    const repository: PlanTaskStateRepository = { getStates: vi.fn(() => ({})), setState: vi.fn() };

    const graph = buildPlan(snapshot(), repository, "/php");

    expect(graph.checks[0]).toEqual({ category: "security", label: "Seguridad", findings: 1 });
    expect(graph.checks.find((check) => check.category === "database")).toEqual({ category: "database", label: "Base de datos", findings: 3 });
    expect(graph.checks.find((check) => check.category === "testing")?.findings).toBe(0);
    expect(graph.checks.some((check) => check.category === "api_access")).toBe(false);
  });

  it("con un snapshot react usa las categorias de react", () => {
    const repository: PlanTaskStateRepository = { getStates: vi.fn(() => ({})), setState: vi.fn() };

    const graph = buildPlan({ ...snapshot(), target: "react" }, repository, "/src");

    expect(graph.checks.at(-1)?.category).toBe("api_access");
  });

  it("fases: salud del proyecto, nivel de proteccion y tareas del plan (XRay X6)", () => {
    const repository = { getStates: () => ({}), setState: () => {} };
    const base = snapshot();
    const healthy = { ...base, scannedFiles: ["/php/a.php", "/php/b.php", "/php/c.php", "/php/d.php"], riskBreakdown: { ...base.riskBreakdown, byFile: [{ key: "/php/a.php", value: 2, byCategory: {}, bySeverity: {}, findingsCount: 1 }] } };

    const graph = buildPlan(healthy, repository, "/php", undefined, "medium");

    expect(graph.phases).toHaveLength(12);
    expect(graph.phases[3].gates[0]).toMatchObject({ key: "protection-level", value: 2, status: "passed" });
    expect(graph.phases[11].gates.find((gate) => gate.key === "healthy-files")?.value).toBe(75);
    expect(graph.phases[4].tasks).toEqual(["close-sql-injections"]);
    expect(graph.phases[2].gates.map((gate) => gate.key)).not.toContain("unused-exports");
    expect(buildPlan({ ...healthy, target: "react" }, repository, "/src").phases[2].gates.map((gate) => gate.key)).toContain("unused-exports");
    expect(buildPlan(healthy, repository, "/php").phases[3].gates[0]).toMatchObject({ value: null, status: "unknown" });
    // Columnas por fase: la fase 3 (seguridad) a la derecha de la 0 (linea base) y un encabezado por fase.
    const sql = graph.nodes.find((node) => node.id === "close-sql-injections")!;
    const third = graph.nodes.find((node) => node.id === "exclude-third-party")!;
    expect(sql.position.x).toBeGreaterThan(third.position.x);
    expect(graph.lanes.map((lane) => lane.phase)).toEqual([0, 3, 6, 10]);
  });

  it("con señales de dependencias agrega sus tareas al grafo", () => {
    const repository = { getStates: () => ({}), setState: () => {} };
    const graph = buildPlan(snapshot(), repository, "/php", { counts: { "remove-unused-packages": 4 }, items: {} });

    expect(graph.nodes.find((node) => node.id === "remove-unused-packages")).toMatchObject({ metric: 4, category: "dependencies" });
  });
});
