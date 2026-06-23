import type { MapProvider } from "../../application/contracts/MapProvider";
import { HttpMapProvider } from "../api/HttpMapProvider";

export interface MigrationExplorerDependencies {
  mapProvider: MapProvider;
}

export function createMigrationExplorerDependencies({
  mapUrl,
  target = "laravel",
}: {
  mapUrl: string;
  target?: string;
}): MigrationExplorerDependencies {
  return {
    mapProvider: new HttpMapProvider(mapUrl, target),
  };
}
