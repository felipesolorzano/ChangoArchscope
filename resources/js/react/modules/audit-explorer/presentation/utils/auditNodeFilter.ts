import type { AuditGraphAccent, AuditGraphEdge, AuditGraphNode } from "../../domain/value-objects/AuditGraph";

export type CategoryFilter = AuditGraphAccent | "all";

/**
 * Filtra el grafo a una sola categoria. Util cuando una categoria de bajo volumen como
 * `php_compatibility` queda enterrada: un archivo con miles de hallazgos de `database` y solo
 * 2 de compat seguia oculto porque su categoria DOMINANTE (el borde/accent) no era compat.
 *
 * Aqui se conserva todo nodo que TENGA al menos un hallazgo de la categoria
 * (`byCategory[category] > 0`), no solo donde domina, mas el nodo "ancla" de cada vista
 * jerarquica (el padre de las aristas `contains`) para no perder el contexto.
 */
export function filterGraphByCategory(
  nodes: AuditGraphNode[],
  edges: AuditGraphEdge[],
  category: CategoryFilter,
): { nodes: AuditGraphNode[]; edges: AuditGraphEdge[] } {
  if (category === "all") {
    return { nodes, edges };
  }

  const anchorIds = new Set(edges.filter((edge) => edge.kind === "contains").map((edge) => edge.source));

  const keptNodes = nodes.filter((node) => anchorIds.has(node.id) || (node.byCategory[category] ?? 0) > 0);
  const keptIds = new Set(keptNodes.map((node) => node.id));
  const keptEdges = edges.filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target));

  return { nodes: keptNodes, edges: keptEdges };
}
