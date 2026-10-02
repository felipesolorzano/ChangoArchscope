import type { ArchitectureGraphNode, ImportCycle } from "../../domain/value-objects/ArchitectureGraph";

/** Id del nodo archivo con ese path (para enfocarlo), o null si no esta en el grafo. */
export function nodeIdForPath(nodes: ArchitectureGraphNode[], path: string): string | null {
  return nodes.find((node) => node.type === "file" && node.path === path)?.id ?? null;
}

/** Recorrido del ciclo con solo el nombre de cada archivo: "a.js → b.js → a.js". */
export function cycleLabel(cycle: ImportCycle): string {
  return cycle.path.map((path) => path.split("/").pop()).join(" → ");
}
