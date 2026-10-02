import type {
  ArchitectureGraph,
  ArchitectureGraphEdge,
  ArchitectureGraphNode,
} from "../../domain/value-objects/ArchitectureGraph";

export interface FilterArchitectureGraphOptions {
  focusedNodeId: string | null;
  selectedModule: string;
  selectedLayer: string;
  query: string;
}

export interface FilteredArchitectureGraph {
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
}

export function filterArchitectureGraph(
  graph: ArchitectureGraph | null,
  options: FilterArchitectureGraphOptions
): FilteredArchitectureGraph {
  if (!graph) {
    return { nodes: [], edges: [] };
  }

  if (options.focusedNodeId && graph.nodes.some((node) => node.id === options.focusedNodeId)) {
    return focusSubgraph(graph, options.focusedNodeId);
  }

  const visibleNodes = graph.nodes.filter(nodeFilter(options));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  return {
    nodes: visibleNodes,
    edges: graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
  };
}

// El nodo enfocado, sus vecinos directos y solo los edges que lo tocan.
function focusSubgraph(graph: ArchitectureGraph, focusedNodeId: string): FilteredArchitectureGraph {
  const connectedEdges = graph.edges.filter((edge) => edge.source === focusedNodeId || edge.target === focusedNodeId);
  const connectedIds = new Set<string>([focusedNodeId]);

  connectedEdges.forEach((edge) => {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  });

  return { nodes: graph.nodes.filter((node) => connectedIds.has(node.id)), edges: connectedEdges };
}

// Filtro por modulo, capa (los nodos modulo siempre pasan) y busqueda en label/path.
function nodeFilter(options: FilterArchitectureGraphOptions): (node: ArchitectureGraphNode) => boolean {
  const normalizedQuery = options.query.trim().toLowerCase();
  const matchesQuery = (node: ArchitectureGraphNode) =>
    !normalizedQuery || node.label.toLowerCase().includes(normalizedQuery) || node.path.toLowerCase().includes(normalizedQuery);

  return (node) =>
    (!options.selectedModule || node.module === options.selectedModule) &&
    (!options.selectedLayer || node.type === "module" || node.layer === options.selectedLayer) &&
    matchesQuery(node);
}
