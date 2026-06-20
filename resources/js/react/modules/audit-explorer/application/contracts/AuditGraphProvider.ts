import type { AuditGraph, AuditGraphView } from "../../domain/value-objects/AuditGraph";

export interface AuditGraphProvider {
  getGraph(target?: "laravel" | "react", view?: AuditGraphView, focus?: string | null): Promise<AuditGraph>;
}
