import { useEffect, useMemo, useState } from "react";
import {
  useNodesState,
  type Node,
  type NodeDragHandler,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { ArchitectureGraphEdge, ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";
import { toArchitectureFlowEdges, toArchitectureFlowNodes } from "./architectureFlowMapping";

interface FilteredArchitectureGraph {
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
}

interface UseArchitectureFlowGraphOptions {
  filteredGraph: FilteredArchitectureGraph;
  focusedNodeId: string | null;
  onFocusNode: (nodeId: string | null) => void;
}

export function useArchitectureFlowGraph({ filteredGraph, focusedNodeId, onFocusNode }: UseArchitectureFlowGraphOptions) {
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<ArchitectureGraphNode>>([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    setFlowNodes(toArchitectureFlowNodes(filteredGraph.nodes, filteredGraph.edges, focusedNodeId, nodePositions));
  }, [filteredGraph.edges, filteredGraph.nodes, focusedNodeId, nodePositions, setFlowNodes]);

  useFitViewOnFocus(flowInstance, focusedNodeId, flowNodes.length);

  const flowEdges = useMemo(() => toArchitectureFlowEdges(filteredGraph.edges), [filteredGraph.edges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => onFocusNode(node.id);

  // Con foco el layout lo decide focusPositionsFor: no se guardan drags.
  const handleNodeDragStop: NodeDragHandler = (_event, node) => {
    if (!focusedNodeId) {
      setNodePositions((positions) => ({ ...positions, [node.id]: node.position }));
    }
  };

  return {
    flowNodes,
    flowEdges,
    onNodesChange,
    setFlowInstance,
    handleNodeClick,
    handleNodeDragStop,
    resetNodePositions: () => setNodePositions({}),
  };
}

// Al enfocar un nodo, encuadra el subgrafo de sus conexiones.
function useFitViewOnFocus(flowInstance: ReactFlowInstance | null, focusedNodeId: string | null, nodeCount: number) {
  useEffect(() => {
    if (focusedNodeId && flowInstance && nodeCount > 0) {
      window.requestAnimationFrame(() => flowInstance.fitView({ duration: 420, padding: 0.22 }));
    }
  }, [flowInstance, nodeCount, focusedNodeId]);
}
