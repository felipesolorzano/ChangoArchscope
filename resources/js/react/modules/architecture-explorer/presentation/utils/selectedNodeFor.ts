import type { ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";

// Nodo a mostrar en el inspector: el enfocado; si no, el primero cuyo path contiene la busqueda.
export function selectedNodeFor(
  nodes: ArchitectureGraphNode[],
  focusedNode: ArchitectureGraphNode | null,
  query: string,
): ArchitectureGraphNode | null {
  if (focusedNode) return focusedNode;

  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  return nodes.find((node) => node.path.toLowerCase().includes(normalized)) ?? null;
}
