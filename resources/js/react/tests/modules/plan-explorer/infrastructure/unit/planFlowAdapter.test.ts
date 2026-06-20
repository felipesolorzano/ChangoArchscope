import { describe, expect, it } from "vitest";

import type { PlanGraphEdge, PlanGraphNode } from "../../../../../modules/plan-explorer/domain/value-objects/PlanGraph";
import { toPlanFlowEdges, toPlanFlowNodes } from "../../../../../modules/plan-explorer/infrastructure/react-flow/planFlowAdapter";

function node(over: Partial<PlanGraphNode> = {}): PlanGraphNode {
  return {
    id: "close-sql-injections",
    title: "Cerrar inyecciones SQL",
    description: "x",
    category: "security",
    state: "pending",
    metric: 104,
    stage: 0,
    position: { x: 0, y: 0 },
    ...over,
  };
}

describe("toPlanFlowNodes", () => {
  it("mapea cada tarea a un RF node draggable con type planTask y su posicion del backend", () => {
    const nodes = toPlanFlowNodes([node({ position: { x: 320, y: 170 } })]);

    expect(nodes[0].id).toBe("close-sql-injections");
    expect(nodes[0].type).toBe("planTask");
    expect(nodes[0].position).toEqual({ x: 320, y: 170 });
    expect(nodes[0].draggable).toBe(true);
    expect(nodes[0].data).toEqual(node({ position: { x: 320, y: 170 } }));
  });

  it("lista vacia -> vacia", () => {
    expect(toPlanFlowNodes([])).toEqual([]);
  });
});

describe("toPlanFlowEdges", () => {
  it("mapea cada dependencia preservando id/source/target con flecha y stroke", () => {
    const edges: PlanGraphEdge[] = [{ id: "dep:a:b", source: "a", target: "b" }];

    const [edge] = toPlanFlowEdges(edges);

    expect(edge).toMatchObject({ id: "dep:a:b", source: "a", target: "b", type: "smoothstep" });
    expect(edge.markerEnd).toBeTruthy();
    expect(edge.style).toMatchObject({ stroke: "#64748b", strokeWidth: 1.6 });
  });

  it("lista vacia -> vacia", () => {
    expect(toPlanFlowEdges([])).toEqual([]);
  });
});
