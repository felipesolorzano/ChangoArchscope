import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap.js";

// Un mapa por (target, proyecto): `project` es la raiz del stack (ver map-persistence.md).
export interface BoundedContextMapRepository {
  getMap(target: string, project: string): BoundedContextMap | null;
  saveMap(target: string, project: string, map: BoundedContextMap): void;
}
