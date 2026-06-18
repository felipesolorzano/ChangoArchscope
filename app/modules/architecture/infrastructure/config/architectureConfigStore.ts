import type { ArchitectureConfig } from "../../domain/value-objects/ArchitectureConfig.js";

let currentConfig: ArchitectureConfig | undefined;

export function setArchitectureConfig(config: ArchitectureConfig): void {
  currentConfig = config;
}

export function getArchitectureConfig(): ArchitectureConfig {
  if (currentConfig === undefined) {
    throw new Error("Architecture config has not been registered.");
  }

  return currentConfig;
}

export function clearArchitectureConfig(): void {
  currentConfig = undefined;
}
