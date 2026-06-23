export type LayerKey = "domain" | "application" | "infrastructure" | "presentation";

export const LAYER_KEYS: LayerKey[] = ["domain", "application", "infrastructure", "presentation"];

export interface BoundedContextFile {
  path: string;
  note?: string;
}

export type BoundedContextLayers = Record<LayerKey, BoundedContextFile[]>;

export interface BoundedContextModule {
  key: string;
  name: string;
  description?: string;
  validated: boolean;
  layers: BoundedContextLayers;
}

export interface BoundedContextMap {
  generatedAt: string;
  generatedBy?: string;
  modules: BoundedContextModule[];
}

export function moduleFileCount(module: BoundedContextModule): number {
  return LAYER_KEYS.reduce((total, layer) => total + module.layers[layer].length, 0);
}
