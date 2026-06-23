import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap.js";

export interface BoundedContextMapRepository {
  getMap(target: string): BoundedContextMap | null;
  saveMap(target: string, map: BoundedContextMap): void;
}
