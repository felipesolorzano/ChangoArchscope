import type { DependenciesProvider } from "../../application/contracts/DependenciesProvider";
import { HttpDependenciesProvider } from "../api/HttpDependenciesProvider";

export interface DependenciesExplorerDependencies {
  dependenciesProvider: DependenciesProvider;
}

export function createDependenciesExplorerDependencies({ reportUrl }: { reportUrl: string }): DependenciesExplorerDependencies {
  return { dependenciesProvider: new HttpDependenciesProvider(reportUrl) };
}
