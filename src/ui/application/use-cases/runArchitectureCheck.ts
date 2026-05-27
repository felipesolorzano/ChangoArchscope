import type { ArchitectureCheck } from "../../domain/value-objects/ArchitectureCheck";
import type { ArchitectureCheckProvider } from "../contracts/ArchitectureCheckProvider";

export async function runArchitectureCheck(
  provider: ArchitectureCheckProvider,
  module?: string,
  target: "laravel" | "react" = "laravel"
): Promise<ArchitectureCheck> {
  return provider.getArchitectureCheck(module, target);
}
