import type { AuditGraphProvider } from "../../application/contracts/AuditGraphProvider";
import { toAuditGraph, type AuditGraphDto } from "../../application/dtos/AuditGraphDto";
import type { AuditGraph, AuditGraphView, AuditHealth } from "../../domain/value-objects/AuditGraph";
import { fetchAuditJson } from "./fetchAuditJson";

export class HttpAuditGraphProvider implements AuditGraphProvider {
  constructor(
    private readonly graphUrl: string,
    private readonly healthUrl: string,
  ) {}

  async getHealth(target: "laravel" | "react", phpVersion: string | null): Promise<AuditHealth> {
    const url = new URL(this.healthUrl, window.location.origin);
    url.searchParams.set("target", target);

    if (phpVersion) {
      url.searchParams.set("php", phpVersion);
    }

    return fetchAuditJson<AuditHealth>(url, "No se pudo cargar la salud del proyecto");
  }

  async getGraph(
    target: "laravel" | "react" = "laravel",
    view: AuditGraphView = "overview",
    focus: string | null = null,
    phpVersion: string | null = null,
  ): Promise<AuditGraph> {
    const url = new URL(this.graphUrl, window.location.origin);
    url.searchParams.set("target", target);
    url.searchParams.set("view", view);

    if (focus) {
      url.searchParams.set("focus", focus);
    }

    if (phpVersion) {
      url.searchParams.set("php", phpVersion);
    }

    const response = await fetchAuditJson<AuditGraphDto>(url, "No se pudo cargar el grafo de auditoria");

    return toAuditGraph(response);
  }
}
