import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AuditGraph, AuditGraphNode, AuditHealth } from "../../../../../modules/audit-explorer/domain/value-objects/AuditGraph";
import { AuditNodeCard } from "../../../../../modules/audit-explorer/infrastructure/react-flow/AuditNodeCard";
import { AuditDetailDrawer } from "../../../../../modules/audit-explorer/presentation/components/AuditDetailDrawer";
import { AuditHealthBar } from "../../../../../modules/audit-explorer/presentation/components/AuditHealthBar";
import { AuditMosaic } from "../../../../../modules/audit-explorer/presentation/components/AuditMosaic";

const html = (element: JSX.Element) => renderToStaticMarkup(element);

const health: AuditHealth = {
  summary: { files: 3, healthy: 2, withFindings: 1, healthyPercent: 67 },
  checks: [
    { category: "security", label: "Seguridad", findings: 0 },
    { category: "testing", label: "Tests", findings: 4 },
  ],
  groups: [
    { key: "", label: "(raíz)", files: 1, withFindings: 0, tiles: [{ path: "main.tsx", label: "main.tsx", findings: 0, risk: 0, tone: "none", accent: "mixed" }] },
    {
      key: "pages",
      label: "pages",
      files: 2,
      withFindings: 1,
      tiles: [
        { path: "pages/a.js", label: "a.js", findings: 0, risk: 0, tone: "none", accent: "mixed" },
        { path: "pages/b.js", label: "b.js", findings: 4, risk: 9, tone: "critical", accent: "testing" },
      ],
    },
  ],
};

const node = (over: Partial<AuditGraphNode> = {}): AuditGraphNode => ({
  id: "app:pages",
  type: "app",
  label: "pages",
  position: { x: 0, y: 0 },
  size: 120,
  tone: "none",
  accent: "mixed",
  severityMix: { high: 0, medium: 0, low: 0 },
  metrics: { findings: 0, risk: 0 },
  byCategory: {},
  badges: [],
  drill: true,
  ...over,
});

describe("AuditHealthBar", () => {
  it("KPI, resumen, barra y checklist", () => {
    const markup = html(<AuditHealthBar health={health} />);

    expect(markup).toContain("67% sano");
    expect(markup).toContain("3 archivos · 2 sanos · 1 con hallazgos");
    expect(markup).toContain("audit-health__bar");
    expect(markup).toMatch(/audit-health__check--ok[^>]*>.*Seguridad/);
    expect(markup).toMatch(/audit-health__check--bad[^>]*>.*Tests/);
    expect(markup).toContain(">4<");
  });

  it("sin salud no renderiza nada", () => {
    expect(html(<AuditHealthBar health={null} />)).toBe("");
  });
});

describe("AuditMosaic", () => {
  it("un bloque por grupo con su resumen y un cuadrito por archivo coloreado", () => {
    const markup = html(<AuditMosaic health={health} onOpenFile={() => {}} />);

    expect(markup).toContain("(raíz)");
    expect(markup).toContain("✓ 1 sanos");
    expect(markup).toContain("1 de 2 con hallazgos");
    expect(markup.match(/audit-mosaic__tile"/g)).toHaveLength(3);
    expect(markup).toContain('title="pages/a.js · sano"');
    expect(markup).toContain('title="pages/b.js · 4 hallazgos"');
    expect(markup).toContain("background:#16a34a");
    expect(markup).toContain("background:#7f1d1d");
  });
});

describe("AuditNodeCard con salud", () => {
  const card = (data: AuditGraphNode) => html(<ReactFlowProvider><AuditNodeCard {...({ id: data.id, data } as never)} /></ReactFlowProvider>);

  it("una app sana muestra ✓ sano y su barra de salud", () => {
    const markup = card(node({ health: { files: 12, withFindings: 0 } }));

    expect(markup).toContain("✓ sano");
    expect(markup).not.toContain("hallazgos</span>");
    expect(markup).toContain("audit-node__health-bar");
    expect(markup).toContain("✓ 12 sanos");
  });

  it("una app con hallazgos muestra el numero y cuantos archivos los tienen", () => {
    const markup = card(node({ metrics: { findings: 7, risk: 9 }, tone: "high", health: { files: 18, withFindings: 3 } }));

    expect(markup).toContain(">7<");
    expect(markup).toContain("3 de 18 con hallazgos");
  });

  it("un archivo (health de 1) no muestra barra de salud", () => {
    expect(card(node({ type: "file", health: { files: 1, withFindings: 0 } }))).not.toContain("audit-node__health-bar");
  });
});

describe("AuditDetailDrawer: checklist del archivo", () => {
  const graph = (focused: AuditGraphNode): AuditGraph => ({
    generated_at: "t",
    view: "file",
    focus: null,
    summary: { nodes: 1, edges: 0, findings: 0, risk: 0 },
    nodes: [focused],
    edges: [],
  });

  it("un archivo muestra cada categoria con ✓ o su cantidad", () => {
    const file = node({ id: "file:pages/b.js", type: "file", byCategory: { testing: 4 } });
    const markup = html(<AuditDetailDrawer graph={graph(file)} focusedNodeId={file.id} checks={health.checks} onClose={() => {}} />);

    expect(markup).toContain("Por categoría");
    expect(markup).toMatch(/audit-drawer__check--ok[^>]*>.*Seguridad/);
    expect(markup).toMatch(/audit-drawer__check--bad[^>]*>.*Tests/);
  });

  it("una app no muestra el checklist", () => {
    const markup = html(<AuditDetailDrawer graph={graph(node())} focusedNodeId="app:pages" checks={health.checks} onClose={() => {}} />);

    expect(markup).not.toContain("Por categoría");
  });
});
