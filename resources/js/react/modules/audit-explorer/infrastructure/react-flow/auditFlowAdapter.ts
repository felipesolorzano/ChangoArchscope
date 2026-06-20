import type { Edge, Node } from "@xyflow/react";

import type { AuditGraphEdge, AuditGraphNode } from "../../domain/value-objects/AuditGraph";

export function toFlowNodes(nodes: AuditGraphNode[]): Node<AuditGraphNode>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "auditNode",
    position: { x: node.position.x, y: node.position.y },
    data: node,
    draggable: true,
  }));
}

export function toFlowEdges(edges: AuditGraphEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.kind === "duplicate",
    style: {
      stroke: edge.kind === "duplicate" ? "#f43f5e" : "#475569",
      strokeWidth: edge.kind === "duplicate" ? 2.4 : 1.4,
      strokeDasharray: edge.kind === "duplicate" ? "6 4" : undefined,
    },
  }));
}
