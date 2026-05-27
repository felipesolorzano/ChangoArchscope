import type { ArchitectureCheck } from "../../domain/value-objects/ArchitectureCheck";

export interface ArchitectureCheckProvider {
  getArchitectureCheck(module?: string, target?: "laravel" | "react"): Promise<ArchitectureCheck>;
}
