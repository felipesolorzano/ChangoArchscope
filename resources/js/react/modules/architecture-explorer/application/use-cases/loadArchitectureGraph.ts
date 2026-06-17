import type { ArchitectureGraph } from "../../domain/value-objects/ArchitectureGraph";
import type { ArchitectureGraphProvider } from "../contracts/ArchitectureGraphProvider";

export async function loadArchitectureGraph(
  provider: ArchitectureGraphProvider,
  module?: string,
  target: "laravel" | "react" = "laravel"
): Promise<ArchitectureGraph> {
  return provider.getGraph(module, target);
}
