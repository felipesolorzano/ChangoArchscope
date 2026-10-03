import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { PlanGraphEdge, PlanGraphNode, PlanLane } from "../../domain/value-objects/PlanGraph";

// Altura del encabezado de fase sobre las tarjetas de su columna.
const LANE_Y = -110;

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

// XRay X6: encabezado fijo de cada columna (fase), arriba de sus tareas.
export function toPlanLaneNodes(lanes: PlanLane[]): Node<PlanLane>[] {
  return lanes.map((lane) => ({ id: `lane:${lane.phase}`, type: "planLane", position: { x: lane.x, y: LANE_Y }, data: lane, draggable: false, selectable: false }));
}
