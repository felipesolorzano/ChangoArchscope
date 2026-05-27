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
    const connectedEdges = graph.edges.filter(
      (edge) => edge.source === options.focusedNodeId || edge.target === options.focusedNodeId
    );
    const connectedIds = new Set<string>([options.focusedNodeId]);

    connectedEdges.forEach((edge) => {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    });

    return {
      nodes: graph.nodes.filter((node) => connectedIds.has(node.id)),
      edges: connectedEdges,
    };
  }

  const normalizedQuery = options.query.trim().toLowerCase();
  const visibleNodes = graph.nodes.filter((node) => {
    const matchesModule = !options.selectedModule || node.module === options.selectedModule;
    const matchesLayer =
      !options.selectedLayer ||
      node.type === "module" ||
      node.layer === options.selectedLayer;
    const matchesQuery =
      !normalizedQuery ||
      node.label.toLowerCase().includes(normalizedQuery) ||
      node.path.toLowerCase().includes(normalizedQuery);

    return matchesModule && matchesLayer && matchesQuery;
  });

  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  return {
    nodes: visibleNodes,
    edges: graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
  };
}
