import type { ArchitectureCheckProvider } from "./ArchitectureCheckProvider";
import type { ArchitectureGraphProvider } from "./ArchitectureGraphProvider";

export interface ArchitectureProviders {
  graphProvider: ArchitectureGraphProvider;
  checkProvider: ArchitectureCheckProvider;
}
