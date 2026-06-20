import { describe, expect, it } from "vitest";

import type { AuditGraphEdge, AuditGraphNode } from "../../../../../modules/audit-explorer/domain/value-objects/AuditGraph";
import { toFlowEdges, toFlowNodes } from "../../../../../modules/audit-explorer/infrastructure/react-flow/auditFlowAdapter";

function node(overrides: Partial<AuditGraphNode> = {}): AuditGraphNode {
  return {
    id: "app:admin",
    type: "app",
    label: "admin",
    position: { x: -260, y: 240 },
    size: 200,
    tone: "high",
    accent: "database",
    severityMix: { high: 5, medium: 2, low: 1 },
    metrics: { findings: 8, risk: 1000 },
    badges: ["database"],
    drill: true,
    ...overrides,
  };
}

describe("toFlowNodes", () => {
  it("mapea cada nodo a un RF node draggable con la misma posicion y type auditNode", () => {
    const nodes = toFlowNodes([node()]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("app:admin");
    expect(nodes[0].type).toBe("auditNode");
    expect(nodes[0].position).toEqual({ x: -260, y: 240 });
    expect(nodes[0].draggable).toBe(true);
  });

  it("conserva el nodo de dominio en data", () => {
    const domain = node({ id: "root", type: "root" });
    const [flow] = toFlowNodes([domain]);

    expect(flow.data).toEqual(domain);
  });

  it("una lista vacia produce una lista vacia", () => {
    expect(toFlowNodes([])).toEqual([]);
  });
});

describe("toFlowEdges", () => {
  it("mapea un edge 'contains' a smoothstep no animado con stroke neutro", () => {
    const edges: AuditGraphEdge[] = [
      { id: "contains:root:app:admin", source: "root", target: "app:admin", kind: "contains" },
    ];

    const [edge] = toFlowEdges(edges);

    expect(edge).toMatchObject({ id: "contains:root:app:admin", source: "root", target: "app:admin", type: "smoothstep" });
    expect(edge.animated).toBe(false);
    expect(edge.style).toMatchObject({ stroke: "#475569", strokeWidth: 1.4, strokeDasharray: undefined });
  });

  it("un edge 'duplicate' es animado, rojo y punteado", () => {
    const edges: AuditGraphEdge[] = [
      { id: "dup", source: "a", target: "b", kind: "duplicate" },
    ];

    const [edge] = toFlowEdges(edges);

    expect(edge.animated).toBe(true);
    expect(edge.style).toMatchObject({ stroke: "#f43f5e", strokeWidth: 2.4, strokeDasharray: "6 4" });
  });

  it("una lista vacia produce una lista vacia", () => {
    expect(toFlowEdges([])).toEqual([]);
  });
});
