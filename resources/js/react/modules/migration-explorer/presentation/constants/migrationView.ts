import type { LayerKey } from "../../domain/value-objects/BoundedContextMap";

const LAYER_COLOR: Record<LayerKey, string> = {
  domain: "#22c55e",
  application: "#3b82f6",
  infrastructure: "#f59e0b",
  presentation: "#ec4899",
};

const LAYER_LABEL: Record<LayerKey, string> = {
  domain: "Domain",
  application: "Application",
  infrastructure: "Infrastructure",
  presentation: "Presentation",
};

export function layerColor(layer: LayerKey): string {
  return LAYER_COLOR[layer] ?? "#94a3b8";
}

export function layerLabel(layer: LayerKey): string {
  return LAYER_LABEL[layer] ?? layer;
}
