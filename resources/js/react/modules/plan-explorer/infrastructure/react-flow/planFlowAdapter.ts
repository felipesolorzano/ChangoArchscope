import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { PlanGraphEdge, PlanGraphNode } from "../../domain/value-objects/PlanGraph";

export function toPlanFlowNodes(nodes: PlanGraphNode[]): Node<PlanGraphNode>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "planTask",
    position: { x: node.position.x, y: node.position.y },
    data: node,
    draggable: true,
  }));
}

export function toPlanFlowEdges(edges: PlanGraphEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#64748b", strokeWidth: 1.6 },
  }));
}
