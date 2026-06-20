import type { AuditGraph } from "../../domain/value-objects/AuditGraph";

export type AuditGraphDto = AuditGraph;

export function toAuditGraph(dto: AuditGraphDto): AuditGraph {
  return {
    generated_at: dto.generated_at,
    view: dto.view,
    focus: dto.focus ?? null,
    summary: dto.summary,
    nodes: dto.nodes,
    edges: dto.edges,
  };
}
