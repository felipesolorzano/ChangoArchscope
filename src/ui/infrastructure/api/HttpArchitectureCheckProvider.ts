import type { ArchitectureCheckProvider } from "../../application/contracts/ArchitectureCheckProvider";
import {
  toArchitectureCheck,
  type ArchitectureCheckDto,
} from "../../application/dtos/ArchitectureCheckDto";
import type { ArchitectureCheck } from "../../domain/value-objects/ArchitectureCheck";
import { fetchArchitectureJson } from "./fetchArchitectureJson";

export class HttpArchitectureCheckProvider implements ArchitectureCheckProvider {
  constructor(private readonly checkUrl: string) {}

  async getArchitectureCheck(module?: string, target: "laravel" | "react" = "laravel"): Promise<ArchitectureCheck> {
    const url = new URL(this.checkUrl, window.location.origin);
    url.searchParams.set("target", target);

    if (module) {
      url.searchParams.set("module", module);
    }

    url.searchParams.set("fail_on_coupling", "1");

    const response = await fetchArchitectureJson<ArchitectureCheckDto>(
      url,
      "No se pudo ejecutar el check"
    );

    return toArchitectureCheck(response);
  }
}
