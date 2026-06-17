import { useEffect, useMemo, useState } from "react";
import {
  MarkerType,
  useNodesState,
  type Edge,
  type Node,
  type NodeDragHandler,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import type {
  ArchitectureGraphEdge,
  ArchitectureGraphNode,
} from "../../domain/value-objects/ArchitectureGraph";
import { focusPositionsFor, groupNodes, positionFor } from "./architectureFlowLayout";

interface FilteredArchitectureGraph {
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
}

interface UseArchitectureFlowGraphOptions {
  filteredGraph: FilteredArchitectureGraph;
  focusedNodeId: string | null;
  onFocusNode: (nodeId: string | null) => void;
}

export function useArchitectureFlowGraph({
  filteredGraph,
  focusedNodeId,
  onFocusNode,
}: UseArchitectureFlowGraphOptions) {
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<ArchitectureGraphNode>>([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  const generatedFlowNodes = useMemo<Node<ArchitectureGraphNode>[]>(() => {
    const grouped = groupNodes(filteredGraph.nodes);
    const focusedPositions = focusedNodeId
      ? focusPositionsFor(filteredGraph.nodes, filteredGraph.edges, focusedNodeId)
      : null;

    return filteredGraph.nodes.map((node) => ({
      id: node.id,
      type: "architectureNode",
      position: focusedPositions?.get(node.id) ?? nodePositions[node.id] ?? positionFor(node, grouped),
      data: node,
      selected: focusedNodeId === node.id,
      draggable: true,
    }));
  }, [filteredGraph.edges, filteredGraph.nodes, focusedNodeId, nodePositions]);

  useEffect(() => {
    setFlowNodes(generatedFlowNodes);
  }, [generatedFlowNodes, setFlowNodes]);

  useEffect(() => {
    if (!focusedNodeId || !flowInstance || flowNodes.length === 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      flowInstance.fitView({
        duration: 420,
        padding: 0.22,
      });
    });
  }, [flowInstance, flowNodes, focusedNodeId]);

  const flowEdges = useMemo<Edge[]>(() => {
    const seen = new Map<string, number>();

    return filteredGraph.edges.map((edge) => {
      const occurrence = seen.get(edge.id) ?? 0;
      seen.set(edge.id, occurrence + 1);
      const id = occurrence === 0 ? edge.id : `${edge.id}:${occurrence}`;

      return {
        id,
        source: edge.source,
        target: edge.target,
        label: edge.crossModule ? "module import" : edge.type,
        animated: edge.crossModule,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: edge.crossModule ? "#f97316" : "#64748b",
          strokeWidth: edge.crossModule ? 2.4 : 1.2,
        },
        labelStyle: {
          fill: edge.crossModule ? "#ffedd5" : "#f8fafc",
          fontSize: 12,
          fontWeight: 800,
        },
        labelBgStyle: {
          fill: edge.crossModule ? "rgba(124, 45, 18, 0.94)" : "rgba(15, 23, 42, 0.94)",
          fillOpacity: 1,
        },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 4,
      };
    });
  }, [filteredGraph.edges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onFocusNode(node.id);
  };

  const handleNodeDragStop: NodeDragHandler = (_event, node) => {
    if (focusedNodeId) {
      return;
    }

    setNodePositions((positions) => ({
      ...positions,
      [node.id]: node.position,
    }));
  };

  function resetNodePositions() {
    setNodePositions({});
  }

  return {
    flowNodes,
    flowEdges,
    onNodesChange,
    setFlowInstance,
    handleNodeClick,
    handleNodeDragStop,
    resetNodePositions,
  };
}
