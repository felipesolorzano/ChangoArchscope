import type { AuditGraph, AuditGraphView } from "../../domain/value-objects/AuditGraph";
import type { AuditGraphProvider } from "../contracts/AuditGraphProvider";

export async function loadAuditGraph(
  provider: AuditGraphProvider,
  target: "laravel" | "react" = "laravel",
  view: AuditGraphView = "overview",
  focus: string | null = null,
): Promise<AuditGraph> {
  return provider.getGraph(target, view, focus);
}
