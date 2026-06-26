import type { AuditGraphAccent, AuditGraphSeverityMix, AuditGraphTone } from "../../domain/value-objects/AuditGraph";

// Paleta apta para daltonicos (tonos calidos vs frios bien diferenciados).
const TONE_FILL: Record<AuditGraphTone, string> = {
  critical: "#7f1d1d",
  high: "#dc2626",
  medium: "#d97706",
  low: "#a16207",
  none: "#334155",
};

const ACCENT_STROKE: Record<AuditGraphAccent, string> = {
  security: "#ef4444",
  database: "#3b82f6",
  complexity: "#a855f7",
  testing: "#f59e0b",
  dead_code: "#94a3b8",
  coupling_low_level: "#14b8a6",
  php_compatibility: "#84cc16",
  mixed: "#cbd5e1",
};

const SEVERITY_BAR_COLORS: Record<keyof AuditGraphSeverityMix, string> = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#eab308",
};

export type SeveritySegment = {
  key: keyof AuditGraphSeverityMix;
  percent: number;
  color: string;
};

export function toneFill(tone: AuditGraphTone): string {
  return TONE_FILL[tone] ?? TONE_FILL.none;
}

export function accentStroke(accent: AuditGraphAccent): string {
  return ACCENT_STROKE[accent] ?? ACCENT_STROKE.mixed;
}

export function severityBarSegments(mix: AuditGraphSeverityMix): SeveritySegment[] {
  const order: Array<keyof AuditGraphSeverityMix> = ["high", "medium", "low"];
  const total = order.reduce((sum, key) => sum + mix[key], 0);

  if (total === 0) {
    return [];
  }

  return order
    .filter((key) => mix[key] > 0)
    .map((key) => ({ key, percent: (mix[key] / total) * 100, color: SEVERITY_BAR_COLORS[key] }));
}
