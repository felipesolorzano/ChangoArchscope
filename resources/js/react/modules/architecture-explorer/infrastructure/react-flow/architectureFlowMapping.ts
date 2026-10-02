import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { ArchitectureGraphEdge, ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";
import { focusPositionsFor, groupNodes, positionFor } from "./architectureFlowLayout";

type Position = { x: number; y: number };

const CROSS_MODULE_STYLE = { stroke: "#f97316", strokeWidth: 2.4, label: "#ffedd5", labelBg: "rgba(124, 45, 18, 0.94)" };
const LOCAL_STYLE = { stroke: "#64748b", strokeWidth: 1.2, label: "#f8fafc", labelBg: "rgba(15, 23, 42, 0.94)" };

// Edges del grafo -> edges de React Flow. Un id repetido recibe sufijo por ocurrencia (React Flow exige
// ids unicos); los cruces entre modulos se destacan.
export function toArchitectureFlowEdges(edges: ArchitectureGraphEdge[]): Edge[] {
  const seen = new Map<string, number>();

  return edges.map((edge) => {
    const occurrence = seen.get(edge.id) ?? 0;
    seen.set(edge.id, occurrence + 1);
    const style = edge.crossModule ? CROSS_MODULE_STYLE : LOCAL_STYLE;

    return {
      id: occurrence === 0 ? edge.id : `${edge.id}:${occurrence}`,
      source: edge.source,
      target: edge.target,
      label: edge.crossModule ? "module import" : edge.type,
      animated: edge.crossModule,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: style.stroke, strokeWidth: style.strokeWidth },
      labelStyle: { fill: style.label, fontSize: 12, fontWeight: 800 },
      labelBgStyle: { fill: style.labelBg, fillOpacity: 1 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
    };
  });
}

// Nodos del grafo -> nodos de React Flow. Posicion: la de foco si hay foco; si no la guardada por drag;
// si no la de grilla.
export function toArchitectureFlowNodes(
  nodes: ArchitectureGraphNode[],
  edges: ArchitectureGraphEdge[],
  focusedNodeId: string | null,
  savedPositions: Record<string, Position>,
): Node<ArchitectureGraphNode>[] {
  const grouped = groupNodes(nodes);
  const focusedPositions = focusedNodeId ? focusPositionsFor(nodes, edges, focusedNodeId) : null;

  return nodes.map((node) => ({
    id: node.id,
    type: "architectureNode",
    position: focusedPositions?.get(node.id) ?? savedPositions[node.id] ?? positionFor(node, grouped),
    data: node,
    selected: focusedNodeId === node.id,
    draggable: true,
  }));
}
