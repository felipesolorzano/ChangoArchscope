import type { AuditHealth, AuditNodeHealth } from "../../domain/value-objects/AuditGraph";

const HEALTHY_COLOR = "#16a34a";
const FINDINGS_COLOR = "#dc2626";

export type HealthSegment = { key: "healthy" | "withFindings"; percent: number; color: string };

// Barra sano/con hallazgos de un nodo (solo los segmentos que existen).
export function healthBarSegments(health: AuditNodeHealth): HealthSegment[] {
  if (health.files === 0) {
    return [];
  }

  const healthy = health.files - health.withFindings;
  const segments: HealthSegment[] = [
    { key: "healthy", percent: (healthy / health.files) * 100, color: HEALTHY_COLOR },
    { key: "withFindings", percent: (health.withFindings / health.files) * 100, color: FINDINGS_COLOR },
  ];

  return segments.filter((segment) => segment.percent > 0);
}

export function healthLabel(health: AuditNodeHealth): string {
  if (health.files === 0) return "";
  if (health.withFindings === 0) return `✓ ${health.files} sanos`;
  return `${health.withFindings} de ${health.files} con hallazgos`;
}

export function healthSummaryText(summary: AuditHealth["summary"]): string {
  return `${summary.files} archivos · ${summary.healthy} sanos · ${summary.withFindings} con hallazgos`;
}

export function checkStatus(findings: number): { ok: boolean; text: string } {
  return findings === 0 ? { ok: true, text: "✓" } : { ok: false, text: String(findings) };
}
