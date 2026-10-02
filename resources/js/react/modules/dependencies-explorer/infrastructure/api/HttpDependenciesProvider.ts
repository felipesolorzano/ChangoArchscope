import type { DependenciesProvider } from "../../application/contracts/DependenciesProvider";
import type { DependencyReport, RuntimeChoice, RuntimeKind } from "../../domain/value-objects/DependencyReport";

const RUNTIME_KINDS: RuntimeKind[] = ["php", "node", "npm"];

export class HttpDependenciesProvider implements DependenciesProvider {
  constructor(private readonly reportUrl: string) {}

  async getReport(target: "laravel" | "react", runtimes: RuntimeChoice, refresh: boolean): Promise<DependencyReport> {
    const url = new URL(this.reportUrl, window.location.origin);
    url.searchParams.set("target", target);
    for (const kind of RUNTIME_KINDS) {
      if (runtimes[kind]) {
        url.searchParams.set(kind, runtimes[kind] as string);
      }
    }
    if (refresh) {
      url.searchParams.set("refresh", "1");
    }

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`No se pudo cargar el reporte de dependencias (${response.status})`);
    }

    return response.json();
  }
}
