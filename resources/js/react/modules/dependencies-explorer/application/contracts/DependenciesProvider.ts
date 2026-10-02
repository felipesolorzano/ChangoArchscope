import type { DependencyReport, RuntimeChoice } from "../../domain/value-objects/DependencyReport";

export interface DependenciesProvider {
  getReport(target: "laravel" | "react", runtimes: RuntimeChoice, refresh: boolean): Promise<DependencyReport>;
}
