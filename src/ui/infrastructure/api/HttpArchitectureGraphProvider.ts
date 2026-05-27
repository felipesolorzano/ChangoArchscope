import type { ArchitectureGraphProvider } from "../../application/contracts/ArchitectureGraphProvider";
import {
  toArchitectureGraph,
  type ArchitectureGraphDto,
} from "../../application/dtos/ArchitectureGraphDto";
import type { ArchitectureGraph } from "../../domain/value-objects/ArchitectureGraph";
import { fetchArchitectureJson } from "./fetchArchitectureJson";

export class HttpArchitectureGraphProvider implements ArchitectureGraphProvider {
  constructor(private readonly graphUrl: string) {}

  async getGraph(module?: string, target: "laravel" | "react" = "laravel"): Promise<ArchitectureGraph> {
    const url = new URL(this.graphUrl, window.location.origin);
    url.searchParams.set("target", target);

    if (module) {
      url.searchParams.set("module", module);
    }

    const response = await fetchArchitectureJson<ArchitectureGraphDto>(
      url,
      "No se pudo cargar el grafo"
    );

    return toArchitectureGraph(response);
  }
}
