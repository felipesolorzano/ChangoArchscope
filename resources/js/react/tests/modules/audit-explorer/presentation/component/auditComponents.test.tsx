import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AuditGraph, AuditGraphNode } from "../../../../../modules/audit-explorer/domain/value-objects/AuditGraph";
import type { AuditExplorerDependencies } from "../../../../../modules/audit-explorer/infrastructure/factory/createAuditExplorerDependencies";
import { AuditNodeCard } from "../../../../../modules/audit-explorer/infrastructure/react-flow/AuditNodeCard";
import { AuditCanvas } from "../../../../../modules/audit-explorer/presentation/components/AuditCanvas";
import { AuditDetailDrawer } from "../../../../../modules/audit-explorer/presentation/components/AuditDetailDrawer";
import { AuditFilters } from "../../../../../modules/audit-explorer/presentation/components/AuditFilters";
import { AuditLegend } from "../../../../../modules/audit-explorer/presentation/components/AuditLegend";
import AuditExplorer, { summaryText } from "../../../../../modules/audit-explorer/presentation/pages/AuditExplorer";

const html = (element: JSX.Element) => renderToStaticMarkup(element);

const node = (over: Partial<AuditGraphNode> = {}): AuditGraphNode => ({
  id: "file:pages/a.js",
  type: "file",
  label: "a.js",
  position: { x: 0, y: 0 },
  size: 120,
  tone: "high",
  accent: "complexity",
  severityMix: { high: 2, medium: 1, low: 0 },
  metrics: { findings: 1234, risk: 5678 },
  byCategory: { complexity: 3 },
  badges: ["complexity", "testing"],
  drill: true,
  ...over,
});
const graphOf = (nodes: AuditGraphNode[]): AuditGraph => ({
  generated_at: "t",
  view: "overview",
  focus: null,
  summary: { nodes: nodes.length, edges: 0, findings: 1500, risk: 2500 },
  nodes,
  edges: [],
});

describe("AuditCanvas", () => {
  const base = { loading: false, error: null, nodes: [], edges: [], onInit: () => {}, onNodeClick: () => {} };

  it("carga, error y lienzo", () => {
    expect(html(<AuditCanvas {...base} loading />)).toContain("Cargando mapa de auditoria...");
    expect(html(<AuditCanvas {...base} error="timeout" />)).toContain("timeout");
    expect(html(<AuditCanvas {...base} />)).toContain("react-flow");
  });
});

describe("AuditNodeCard", () => {
  const card = (data: AuditGraphNode) => html(<ReactFlowProvider><AuditNodeCard {...({ id: data.id, data } as never)} /></ReactFlowProvider>);

  it("label, hallazgos y risk formateados, barra y badges", () => {
    const markup = card(node());

    expect(markup).toContain("a.js");
    expect(markup).toContain(">1,234<");
    expect(markup).toContain("risk 5,678");
    expect(markup).toContain("audit-node__bar");
    expect(markup).toContain(">testing<");
  });

  it("sin severidades ni badges no muestra barra ni badges", () => {
    const markup = card(node({ severityMix: { high: 0, medium: 0, low: 0 }, badges: [] }));

    expect(markup).not.toContain("audit-node__bar");
    expect(markup).not.toContain("audit-node__badges");
  });
});

describe("AuditDetailDrawer", () => {
  it("sin nodo enfocado no renderiza nada", () => {
    expect(html(<AuditDetailDrawer graph={graphOf([node()])} focusedNodeId="otro" onClose={() => {}} />)).toBe("");
    expect(html(<AuditDetailDrawer graph={null} focusedNodeId="file:pages/a.js" onClose={() => {}} />)).toBe("");
  });

  it("muestra metricas, leyenda de severidad, señales, hallazgos y ayuda de drill", () => {
    const focused = node({ findings: [{ line: 7, severity: "high", message: "muy largo" }] });
    const markup = html(<AuditDetailDrawer graph={graphOf([focused])} focusedNodeId={focused.id} onClose={() => {}} />);

    expect(markup).toContain(">file<");
    expect(markup).toContain("1,234");
    expect(markup).toContain("5,678");
    expect(markup).toContain("High 2");
    expect(markup).toContain("Señales");
    expect(markup).toContain("mostrando 1 de 1,234");
    expect(markup).toContain("L7");
    expect(markup).toContain("muy largo");
    expect(markup).toContain("Click para profundizar en este nodo.");
  });

  it("omite señales, hallazgos y ayuda de drill cuando no aplican", () => {
    const plain = node({ badges: [], findings: [], drill: false });
    const markup = html(<AuditDetailDrawer graph={graphOf([plain])} focusedNodeId={plain.id} onClose={() => {}} />);

    expect(markup).not.toContain("Señales");
    expect(markup).not.toContain("Hallazgos");
    expect(markup).not.toContain("Click para profundizar");
  });

  it("sin 'mostrando' cuando estan todos los hallazgos", () => {
    const all = node({ metrics: { findings: 1, risk: 1 }, findings: [{ line: 1, severity: "low", message: "x" }] });

    expect(html(<AuditDetailDrawer graph={graphOf([all])} focusedNodeId={all.id} onClose={() => {}} />)).not.toContain("mostrando");
  });
});

describe("AuditFilters y AuditLegend", () => {
  const filters = (target: "laravel" | "react") =>
    html(<AuditFilters target={target} phpVersion={null} onPhpVersionChange={() => {}} category="all" onCategoryChange={() => {}} />);

  it("PHP objetivo solo con laravel; categorias del stack", () => {
    expect(filters("laravel")).toContain("PHP objetivo");
    expect(filters("laravel")).toContain("Compatibilidad PHP");
    expect(filters("react")).not.toContain("PHP objetivo");
    expect(filters("react")).toContain("API / HTTP");
    expect(filters("react")).toContain("Todas las categorias");
  });

  it("la leyenda lista las categorias del stack y Mixto", () => {
    const markup = html(<AuditLegend target="react" />);

    expect(markup).toContain("API / HTTP");
    expect(markup).toContain("Mixto");
    expect(markup).not.toContain("Compatibilidad PHP");
  });
});

describe("AuditExplorer", () => {
  it("miga, boton de escaneo, toggle de vistas y lienzo cargando", () => {
    const dependencies: AuditExplorerDependencies = {
      graphProvider: { getGraph: () => new Promise(() => {}), getHealth: () => new Promise(() => {}) },
    };
    const markup = html(<AuditExplorer dependencies={dependencies} target="react" />);

    expect(markup).toContain("Monorepo");
    expect(markup).toContain("Escaneando…");
    expect(markup).toContain("Mapa por apps");
    expect(markup).toContain("Heatmap global");
    expect(markup).toContain("Mosaico");
    expect(markup).toContain("Cargando mapa de auditoria...");
  });

  it("summaryText cuenta nodos sin la raiz (todos en heatmap) con la unidad de la vista", () => {
    const graph = graphOf([node(), node(), node()]);

    expect(summaryText(graph, "overview")).toBe("1,500 hallazgos · risk 2,500 · 2 apps · click en un nodo para profundizar");
    expect(summaryText(graph, "app")).toBe("1,500 hallazgos · risk 2,500 · 2 archivos · click en un nodo para profundizar");
    expect(summaryText(graph, "heatmap")).toBe("1,500 hallazgos · risk 2,500 · 3 archivos · click en un nodo para profundizar");
    expect(summaryText(graph, "file")).toBe("1,500 hallazgos · risk 2,500 · 2 reglas");
  });
});
