import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import { HttpArchitectureCheckProvider } from "../api/HttpArchitectureCheckProvider";
import { HttpArchitectureGraphProvider } from "../api/HttpArchitectureGraphProvider";

interface ArchitectureExplorerDependencyUrls {
  graphUrl: string;
  checkUrl: string;
}

export function createArchitectureExplorerDependencies({
  graphUrl,
  checkUrl,
}: ArchitectureExplorerDependencyUrls): ArchitectureProviders {
  return {
    graphProvider: new HttpArchitectureGraphProvider(graphUrl),
    checkProvider: new HttpArchitectureCheckProvider(checkUrl),
  };
}
