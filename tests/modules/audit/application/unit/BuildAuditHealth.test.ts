import { describe, expect, it } from "vitest";

import type { AuditSnapshot, RiskEntry } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { buildAuditHealth } from "../../../../../app/modules/audit/application/use-cases/BuildAuditHealth.js";

function entry(key: string, over: Partial<RiskEntry> = {}): RiskEntry {
  return { key, value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0, ...over };
}

function snapshot(scannedFiles: string[], byFile: RiskEntry[] = [], byCategory: Record<string, number> = {}): AuditSnapshot {
  return {
    generatedAt: "t",
    target: "react",
    module: null,
    summary: { files_scanned: 0, files_skipped: 0, modules: 0, findings_count: 0, by_category: byCategory, by_severity: {} },
    findings: [],
    riskScore: { value: 0, breakdown: {} },
    riskBreakdown: { byFile, byClass: [], byModule: [], topRiskiestFiles: [] },
    skippedFiles: [],
    scannedFiles,
  };
}

describe("buildAuditHealth", () => {
  it("resumen: archivos, sanos, con hallazgos y porcentaje sano redondeado", () => {
    const health = buildAuditHealth(
      snapshot(["/r/a/x.js", "/r/a/y.js", "/r/b/z.js"], [entry("/r/a/x.js", { findingsCount: 2 })]),
      "/r",
      "react",
    );

    expect(health.summary).toEqual({ files: 3, healthy: 2, withFindings: 1, healthyPercent: 67 });
  });

  it("un proyecto sin archivos es 100% sano", () => {
    expect(buildAuditHealth(snapshot([]), "/r", "react").summary).toEqual({ files: 0, healthy: 0, withFindings: 0, healthyPercent: 100 });
  });

  it("los archivos con hallazgos que no paso el parser entran al universo sin repetirse", () => {
    const health = buildAuditHealth(snapshot(["/r/a/x.js"], [entry("/r/a/x.js", { findingsCount: 1 }), entry("/r/a/arch.js", { findingsCount: 1 })]), "/r", "react");

    expect(health.summary).toMatchObject({ files: 2, withFindings: 2, healthy: 0 });
  });

  it("checks de react: categorias comunes + api_access, con su conteo", () => {
    const health = buildAuditHealth(snapshot([], [], { security: 3, api_access: 2 }), "/r", "react");

    expect(health.checks).toEqual([
      { category: "security", label: "Seguridad", findings: 3 },
      { category: "architecture_violation", label: "Arquitectura", findings: 0 },
      { category: "coupling_module", label: "Acoplamiento entre módulos", findings: 0 },
      { category: "complexity", label: "Complejidad", findings: 0 },
      { category: "coupling_low_level", label: "Acoplamiento de bajo nivel", findings: 0 },
      { category: "dead_code", label: "Código muerto", findings: 0 },
      { category: "testing", label: "Tests", findings: 0 },
      { category: "api_access", label: "API / HTTP", findings: 2 },
    ]);
  });

  it("checks de laravel: comunes + base de datos y compatibilidad PHP", () => {
    const categories = buildAuditHealth(snapshot([]), "/r", "laravel").checks.map((check) => check.category);

    expect(categories.slice(-2)).toEqual(["database", "php_compatibility"]);
    expect(buildAuditHealth(snapshot([]), "/r", "laravel").checks.slice(-2).map((check) => check.label)).toEqual(["Base de datos", "Compatibilidad PHP"]);
    expect(categories).not.toContain("api_access");
  });

  it("grupos por primera carpeta (raiz aparte), tiles por ruta con tono y acento", () => {
    const health = buildAuditHealth(
      snapshot(
        ["/r/pages/b.js", "/r/pages/a.js", "/r/index.js", "/r/components/c.js"],
        [entry("/r/pages/b.js", { findingsCount: 4, value: 9, bySeverity: { critical: 1 }, byCategory: { security: 4 } })],
      ),
      "/r",
      "react",
    );

    expect(health.groups.map((group) => [group.key, group.label, group.files, group.withFindings])).toEqual([
      ["", "(raíz)", 1, 0],
      ["components", "components", 1, 0],
      ["pages", "pages", 2, 1],
    ]);
    expect(health.groups[2].tiles).toEqual([
      { path: "pages/a.js", label: "a.js", findings: 0, risk: 0, tone: "none", accent: "mixed" },
      { path: "pages/b.js", label: "b.js", findings: 4, risk: 9, tone: "critical", accent: "security" },
    ]);
    expect(health.groups[0].tiles[0]).toMatchObject({ path: "index.js", label: "index.js" });
  });
});
