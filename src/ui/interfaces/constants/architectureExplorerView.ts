import type { ArchitectureLayer } from "../../domain/value-objects/ArchitectureGraph";

export const architectureLayerOrder: Array<Exclude<ArchitectureLayer, null>> = [
  "Domain",
  "Application",
  "Infrastructure",
  "Presentation",
];

export const architectureLayerColors: Record<string, string> = {
  Domain: "#12b981",
  Application: "#3b82f6",
  Infrastructure: "#f59e0b",
  Presentation: "#ec4899",
  module: "#f8fafc",
};
