import type { ArchitectureEdge, ArchitectureNode } from "../../../architecture/domain/value-objects/ArchitectureGraph.js";
import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";

export type CharacterizationTarget = "laravel" | "react";

/** De donde salen los datos: snapshot cacheado del audit, grafo de arquitectura y raiz del stack. */
export type CharacterizationSources = {
  snapshots: { getSnapshot(target: CharacterizationTarget): Promise<AuditSnapshot> };
  graphOf: (target: CharacterizationTarget) => { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
  rootOf: (target: CharacterizationTarget) => string;
};
