export type LayerKey = "domain" | "application" | "infrastructure" | "presentation";

export const LAYER_KEYS: LayerKey[] = ["domain", "application", "infrastructure", "presentation"];

export type BoundedContextFile = {
  path: string;
  note?: string;
};

export type BoundedContextLayers = Record<LayerKey, BoundedContextFile[]>;

export type BoundedContextModule = {
  key: string;
  name: string;
  description?: string;
  validated: boolean;
  layers: BoundedContextLayers;
};

export type BoundedContextMap = {
  generatedAt: string;
  generatedBy?: string;
  modules: BoundedContextModule[];
};
