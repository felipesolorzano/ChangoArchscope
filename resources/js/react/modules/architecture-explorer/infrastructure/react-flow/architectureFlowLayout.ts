import type {
  ArchitectureGraphEdge,
  ArchitectureGraphNode,
  ArchitectureLayer,
} from "../../domain/value-objects/ArchitectureGraph";

const layerOrder: Array<Exclude<ArchitectureLayer, null>> = [
  "Domain",
  "Application",
  "Infrastructure",
  "Presentation",
];

// Grupo de apilado de la grilla: modulo + capa (el modulo y sus archivos sin capa comparten grupo).
function groupKey(node: ArchitectureGraphNode): string {
  return `${node.module}:${node.layer}`;
}

export function groupNodes(nodes: ArchitectureGraphNode[]) {
  const indexes = new Map<string, number>();

  nodes.forEach((node) => {
    const key = groupKey(node);
    indexes.set(key, 0);
  });

  return indexes;
}

export function positionFor(
  node: ArchitectureGraphNode,
  grouped: Map<string, number>
): { x: number; y: number } {
  const modules = Array.from(new Set(Array.from(grouped.keys()).map((key) => key.split(":")[0]))).sort();
  const moduleIndex = Math.max(0, modules.indexOf(node.module));
  // Modulos y archivos sin capa: indexOf(null) = -1 -> columna 0.
  const layerIndex = layerOrder.indexOf(node.layer as Exclude<ArchitectureLayer, null>) + 1;
  const key = groupKey(node);
  const current = grouped.get(key) ?? 0;

  grouped.set(key, current + 1);

  return {
    x: moduleIndex * 420 + layerIndex * 72,
    y: node.type === "module" ? 0 : current * 92 + 140,
  };
}

export function focusPositionsFor(
  nodes: ArchitectureGraphNode[],
  edges: ArchitectureGraphEdge[],
  focusedNodeId: string
): Map<string, { x: number; y: number }> {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const { incomingIds, outgoingIds } = focusNeighbourIds(edges, focusedNodeId);
  const nodesFor = (ids: string[]) => sortFocusNodes(ids.map((id) => nodeMap.get(id)).filter((node): node is ArchitectureGraphNode => Boolean(node)));

  const incoming = nodesFor(Array.from(incomingIds));
  const outgoing = nodesFor(Array.from(outgoingIds).filter((id) => !incomingIds.has(id)));
  const shared = nodesFor(Array.from(outgoingIds).filter((id) => incomingIds.has(id)));
  const positions = new Map<string, { x: number; y: number }>();
  const top = 80;
  const rowGap = 112;
  const centerY = Math.max(top + Math.floor(Math.max(incoming.length, outgoing.length, shared.length) / 2) * rowGap, 240);

  // Los compartidos tambien son entrantes: se ubican al final para quedar debajo del foco.
  placeColumn(incoming, 80, top, rowGap, positions);
  placeColumn(outgoing, 840, top, rowGap, positions);
  placeColumn(shared, 460, centerY + 130, rowGap, positions);

  if (nodeMap.has(focusedNodeId)) {
    positions.set(focusedNodeId, { x: 460, y: centerY });
  }

  return positions;
}

// Vecinos directos del nodo enfocado, sin contarse a si mismo.
function focusNeighbourIds(edges: ArchitectureGraphEdge[], focusedNodeId: string) {
  const incomingIds = new Set<string>();
  const outgoingIds = new Set<string>();

  edges.forEach((edge) => {
    if (edge.target === focusedNodeId && edge.source !== focusedNodeId) {
      incomingIds.add(edge.source);
    }

    if (edge.source === focusedNodeId && edge.target !== focusedNodeId) {
      outgoingIds.add(edge.target);
    }
  });

  return { incomingIds, outgoingIds };
}

function placeColumn(
  nodes: ArchitectureGraphNode[],
  x: number,
  y: number,
  gap: number,
  positions: Map<string, { x: number; y: number }>
): void {
  nodes.forEach((node, index) => {
    positions.set(node.id, { x, y: y + index * gap });
  });
}

function sortFocusNodes(nodes: ArchitectureGraphNode[]): ArchitectureGraphNode[] {
  return [...nodes].sort((a, b) => {
    // Los modulos tienen capa null: indexOf da -1 y quedan primero.
    const layerA = layerOrder.indexOf(a.layer as Exclude<ArchitectureLayer, null>);
    const layerB = layerOrder.indexOf(b.layer as Exclude<ArchitectureLayer, null>);

    return (
      layerA - layerB ||
      a.module.localeCompare(b.module) ||
      a.label.localeCompare(b.label)
    );
  });
}
