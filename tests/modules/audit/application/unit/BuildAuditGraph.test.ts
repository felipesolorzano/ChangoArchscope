import { describe, expect, it } from "vitest";

import type { AuditFinding, AuditSnapshot, RiskEntry } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { MAX_NODE_SIZE, MIN_NODE_SIZE, ROW_Y } from "../../../../../app/modules/audit/domain/services/auditGraphLayout.js";
import { buildAuditGraph } from "../../../../../app/modules/audit/application/use-cases/BuildAuditGraph.js";

function entry(overrides: Partial<RiskEntry> = {}): RiskEntry {
  return { key: "x", value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0, ...overrides };
}

function buildSnapshot(byModule: RiskEntry[], byFile: RiskEntry[] = [], findings: AuditFinding[] = []): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: "mc",
    summary: {
      files_scanned: 100,
      files_skipped: 0,
      modules: byModule.length,
      findings_count: 30,
      by_category: { database: 20, security: 10 },
      by_severity: { high: 12, medium: 10, low: 8 },
    },
    findings,
    riskScore: { value: 999, breakdown: {} },
    riskBreakdown: { byFile, byClass: [], byModule, topRiskiestFiles: [] },
    skippedFiles: [],
  };
}

function finding(file: string, rule: string, category: string, severity: AuditFinding["severity"]): AuditFinding {
  return { category, rule, severity, source: "native", module: "", class: null, file, line: 1, message: "x", details: {} };
}

describe("buildAuditGraph (overview)", () => {
  const byModule = [
    entry({ key: "admin", value: 1000, byCategory: { database: 30, security: 20 }, bySeverity: { high: 5, low: 2 }, findingsCount: 7 }),
    entry({ key: "api", value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0 }),
  ];

  it("genera 1 raiz + N apps y N edges contains desde la raiz", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));

    const root = graph.nodes.find((node) => node.type === "root");
    const apps = graph.nodes.filter((node) => node.type === "app");

    expect(graph.view).toBe("overview");
    expect(root?.id).toBe("root");
    expect(apps.map((node) => node.id)).toEqual(["app:admin", "app:api"]);
    expect(graph.edges).toEqual([
      { id: "contains:root:app:admin", source: "root", target: "app:admin", kind: "contains" },
      { id: "contains:root:app:api", source: "root", target: "app:api", kind: "contains" },
    ]);
  });

  it("el accent de una app es la categoria con mayor peso en su byCategory", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));
    const admin = graph.nodes.find((node) => node.id === "app:admin");

    expect(admin?.accent).toBe("database");
  });

  it("badges = top 2 categorias por peso (orden desc) tanto en apps como en la raiz", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));

    expect(graph.nodes.find((node) => node.id === "app:admin")?.badges).toEqual(["database", "security"]);
    expect(graph.nodes.find((node) => node.type === "root")?.badges).toEqual(["database", "security"]);
  });

  it("tamano: la app de mayor risk es MAX y la de risk 0 es MIN", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));

    expect(graph.nodes.find((node) => node.id === "app:admin")?.size).toBe(MAX_NODE_SIZE);
    expect(graph.nodes.find((node) => node.id === "app:api")?.size).toBe(MIN_NODE_SIZE);
  });

  it("posiciona las apps en una fila (y = ROW_Y) y la raiz en el origen", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));

    expect(graph.nodes.find((node) => node.type === "root")?.position).toEqual({ x: 0, y: 0 });
    expect(graph.nodes.filter((node) => node.type === "app").every((node) => node.position.y === ROW_Y)).toBe(true);
  });

  it("la app lleva su severityMix (critical plegado en high), tone, metrics y drill", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));
    const admin = graph.nodes.find((node) => node.id === "app:admin");

    expect(admin?.severityMix).toEqual({ high: 5, medium: 0, low: 2 });
    expect(admin?.tone).toBe("high");
    expect(admin?.metrics).toEqual({ findings: 7, risk: 1000 });
    expect(admin?.drill).toBe(true);
  });

  it("la raiz toma label/metrics del snapshot y drill true cuando hay apps", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule));
    const root = graph.nodes.find((node) => node.type === "root");

    expect(root?.label).toBe("mc");
    expect(root?.metrics).toEqual({ findings: 30, risk: 999 });
    expect(root?.drill).toBe(true);
    expect(graph.summary).toEqual({ nodes: 3, edges: 2, findings: 30, risk: 999 });
  });

  it("la raiz usa label 'proyecto' cuando snapshot.module es null", () => {
    const snapshot = buildSnapshot(byModule);
    snapshot.module = null;

    const graph = buildAuditGraph(snapshot);

    expect(graph.nodes.find((node) => node.type === "root")?.label).toBe("proyecto");
  });

  it("sin apps (byModule vacio) devuelve solo la raiz, sin edges y con root.drill false", () => {
    const graph = buildAuditGraph(buildSnapshot([]));

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe("root");
    expect(graph.nodes[0].drill).toBe(false);
    expect(graph.edges).toEqual([]);
  });

  it("propaga el focus recibido en options", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule), { focus: "admin" });

    expect(graph.focus).toBe("admin");
  });
});

describe("buildAuditGraph (app view / drill-down)", () => {
  const byModule = [entry({ key: "admin", value: 500, byCategory: { database: 40 }, bySeverity: { high: 8 }, findingsCount: 12 })];
  const byFile = [
    entry({ key: "/root/admin/OrderService.lib.inc", value: 80, byCategory: { database: 50, security: 20 }, bySeverity: { high: 10, low: 5 }, findingsCount: 15 }),
    entry({ key: "/root/admin/OrderService_new.lib.inc", value: 60, byCategory: { database: 40 }, bySeverity: { high: 8 }, findingsCount: 8 }),
    entry({ key: "/root/admin/Other.php", value: 10, byCategory: { testing: 10 }, bySeverity: { medium: 3 }, findingsCount: 3 }),
    entry({ key: "/root/api/Elsewhere.php", value: 5, byCategory: { complexity: 5 }, bySeverity: { low: 5 }, findingsCount: 5 }),
  ];

  function appGraph() {
    return buildAuditGraph(buildSnapshot(byModule, byFile), { view: "app", focus: "admin", phpRoot: "/root" });
  }

  it("la raiz es la app enfocada y los nodos son sus archivos (excluye otras apps)", () => {
    const graph = appGraph();

    expect(graph.view).toBe("app");
    expect(graph.focus).toBe("admin");
    const root = graph.nodes.find((node) => node.type === "app");
    expect(root?.id).toBe("app:admin");
    expect(root?.metrics).toEqual({ findings: 12, risk: 500 });
    expect(graph.nodes.filter((node) => node.type === "file").every((node) => node.drill === false)).toBe(true);
    expect(graph.nodes.filter((node) => node.type === "file").map((node) => node.label)).toEqual([
      "OrderService.lib.inc",
      "OrderService_new.lib.inc",
      "Other.php",
    ]);
    expect(graph.nodes.some((node) => node.label === "Elsewhere.php")).toBe(false);
  });

  it("genera edges contains de la app a cada archivo y un edge duplicate para el par _new", () => {
    const graph = appGraph();

    const contains = graph.edges.filter((edge) => edge.kind === "contains");
    const duplicate = graph.edges.filter((edge) => edge.kind === "duplicate");

    expect(contains).toHaveLength(3);
    expect(duplicate).toEqual([
      {
        id: "duplicate:file:admin/OrderService.lib.inc:file:admin/OrderService_new.lib.inc",
        source: "file:admin/OrderService.lib.inc",
        target: "file:admin/OrderService_new.lib.inc",
        kind: "duplicate",
      },
    ]);
  });

  it("el archivo de mayor risk es MAX y los demas mas chicos; accent/tone vienen de su entry", () => {
    const graph = appGraph();
    const top = graph.nodes.find((node) => node.label === "OrderService.lib.inc");
    const low = graph.nodes.find((node) => node.label === "Other.php");

    expect(top?.size).toBe(MAX_NODE_SIZE);
    expect(low?.size).toBeLessThan(MAX_NODE_SIZE);
    expect(low?.size).toBeGreaterThanOrEqual(MIN_NODE_SIZE);
    expect(top?.accent).toBe("database");
    expect(top?.severityMix).toEqual({ high: 10, medium: 0, low: 5 });
  });

  it("cae a overview cuando falta phpRoot o focus", () => {
    expect(buildAuditGraph(buildSnapshot(byModule, byFile), { view: "app", focus: "admin" }).view).toBe("overview");
    expect(buildAuditGraph(buildSnapshot(byModule, byFile), { view: "app", phpRoot: "/root" }).view).toBe("overview");
  });

  it("una vista no de drill (overview) con focus y phpRoot sigue siendo overview", () => {
    const graph = buildAuditGraph(buildSnapshot(byModule, byFile), { focus: "admin", phpRoot: "/root" });

    expect(graph.view).toBe("overview");
  });
});

describe("buildAuditGraph (file view / drill nivel 2)", () => {
  const byFile = [entry({ key: "/root/admin/OrderService.lib.inc", value: 100, byCategory: { database: 80 }, bySeverity: { high: 20 }, findingsCount: 30 })];
  const findings = [
    finding("/root/admin/OrderService.lib.inc", "raw-sql-outside-infrastructure", "database", "medium"),
    finding("/root/admin/OrderService.lib.inc", "raw-sql-outside-infrastructure", "database", "medium"),
    finding("/root/admin/OrderService.lib.inc", "sql-concatenation", "security", "high"),
    finding("/root/admin/Other.php", "long-method", "complexity", "low"),
  ];

  function fileGraph() {
    return buildAuditGraph(buildSnapshot([], byFile, findings), {
      view: "file",
      focus: "admin/OrderService.lib.inc",
      phpRoot: "/root",
    });
  }

  it("la raiz es el archivo y los nodos son sus reglas (excluye otros archivos)", () => {
    const graph = fileGraph();

    expect(graph.view).toBe("file");
    const root = graph.nodes.find((node) => node.type === "file");
    expect(root?.id).toBe("file:admin/OrderService.lib.inc");
    expect(root?.label).toBe("OrderService.lib.inc");
    expect(root?.metrics).toEqual({ findings: 30, risk: 100 });

    const rules = graph.nodes.filter((node) => node.type === "rule");
    expect(rules.map((node) => node.label)).toEqual(["raw-sql-outside-infrastructure", "sql-concatenation"]);
    expect(graph.nodes.some((node) => node.label === "long-method")).toBe(false);
  });

  it("cada regla lleva metrics, accent por categoria, id e edge contains; tamano por risk", () => {
    const graph = fileGraph();
    const sqlRule = graph.nodes.find((node) => node.label === "raw-sql-outside-infrastructure");
    const secRule = graph.nodes.find((node) => node.label === "sql-concatenation");

    expect(sqlRule?.metrics).toEqual({ findings: 2, risk: 4 });
    expect(sqlRule?.id).toBe("rule:admin/OrderService.lib.inc:raw-sql-outside-infrastructure");
    expect(sqlRule?.size).toBe(MAX_NODE_SIZE);
    expect(sqlRule?.accent).toBe("database");
    expect(sqlRule?.drill).toBe(false);
    expect(secRule?.accent).toBe("security");
    expect(graph.edges.filter((edge) => edge.kind === "contains")).toHaveLength(2);
  });

  it("cada nodo regla adjunta la lista de hallazgos (line/severity/message)", () => {
    const graph = fileGraph();
    const sqlRule = graph.nodes.find((node) => node.label === "raw-sql-outside-infrastructure");

    expect(sqlRule?.findings).toEqual([
      { line: 1, severity: "medium", message: "x" },
      { line: 1, severity: "medium", message: "x" },
    ]);
  });

  it("cae a overview si falta focus o phpRoot", () => {
    expect(buildAuditGraph(buildSnapshot([], byFile, findings), { view: "file", phpRoot: "/root" }).view).toBe("overview");
  });
});

describe("buildAuditGraph (heatmap global)", () => {
  // Archivos de distintas apps; risk y findings en ordenes distintos para probar el orden.
  const byFile = [
    entry({ key: "/root/admin/Big.lib.inc", value: 100, byCategory: { database: 80 }, bySeverity: { high: 3 }, findingsCount: 5 }),
    entry({ key: "/root/api/Many.lib.inc", value: 50, byCategory: { security: 40 }, bySeverity: { high: 30 }, findingsCount: 30 }),
  ];

  function heatmap() {
    return buildAuditGraph(buildSnapshot([], byFile), { view: "heatmap", phpRoot: "/root" });
  }

  it("es una grilla plana de archivos (sin raiz ni edges), ordenada por cantidad de hallazgos", () => {
    const graph = heatmap();

    expect(graph.view).toBe("heatmap");
    expect(graph.edges).toEqual([]);
    expect(graph.nodes.every((node) => node.type === "file")).toBe(true);
    expect(graph.nodes.map((node) => node.label)).toEqual(["Many.lib.inc", "Big.lib.inc"]);
    expect(graph.nodes.map((node) => node.id)).toEqual(["file:api/Many.lib.inc", "file:admin/Big.lib.inc"]);
  });

  it("el tamano se escala por cantidad de hallazgos (no por risk) y los nodos permiten drill", () => {
    const graph = heatmap();
    const many = graph.nodes.find((node) => node.label === "Many.lib.inc");
    const big = graph.nodes.find((node) => node.label === "Big.lib.inc");

    expect(many?.size).toBe(MAX_NODE_SIZE); // 30 hallazgos = el maximo
    expect(big?.size).toBeLessThan(MAX_NODE_SIZE); // 5 hallazgos
    expect(graph.nodes.every((node) => node.drill === true)).toBe(true);
  });

  it("cae a overview si falta phpRoot", () => {
    expect(buildAuditGraph(buildSnapshot([], byFile), { view: "heatmap" }).view).toBe("overview");
  });
});
