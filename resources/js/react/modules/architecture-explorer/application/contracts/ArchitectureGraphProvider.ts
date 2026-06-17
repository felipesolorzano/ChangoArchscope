import type { ArchitectureGraph } from "../../domain/value-objects/ArchitectureGraph";

export interface ArchitectureGraphProvider {
  getGraph(module?: string, target?: "laravel" | "react"): Promise<ArchitectureGraph>;
}
