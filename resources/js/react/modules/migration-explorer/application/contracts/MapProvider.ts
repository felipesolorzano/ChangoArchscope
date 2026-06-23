import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap";

export interface MapProvider {
  getMap(): Promise<BoundedContextMap>;
  saveMap(map: BoundedContextMap): Promise<BoundedContextMap>;
}
