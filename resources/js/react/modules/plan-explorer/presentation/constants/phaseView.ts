import type { PlanGate, PlanPhase, PlanPhaseStatus } from "../../domain/value-objects/PlanGraph";

const STATUS_LABELS: Record<PlanPhaseStatus, string> = { passed: "Cumplida", failed: "Pendiente", unknown: "Sin datos", "not-applicable": "No aplica" };
const STATUS_COLORS: Record<PlanPhaseStatus, string> = { passed: "#16a34a", failed: "#dc2626", unknown: "#64748b", "not-applicable": "#475569" };
const LEVELS = ["Ninguna", "Baja", "Media", "Alta"];

export function phaseStatusLabel(status: PlanPhaseStatus): string {
  return STATUS_LABELS[status];
}

export function phaseStatusColor(status: PlanPhaseStatus): string {
  return STATUS_COLORS[status];
}

function formatted(value: number, format: PlanGate["format"]): string {
  if (format === "percent") return `${value}%`;
  return format === "level" ? LEVELS[value] : String(value);
}

export function gateValue(gate: PlanGate): string {
  return gate.value === null ? "sin datos" : formatted(gate.value, gate.format);
}

export function gateTarget(gate: PlanGate): string {
  return `${gate.comparator === "max" ? "≤" : "≥"} ${formatted(gate.target, gate.format)}`;
}

export function currentPhase(phases: PlanPhase[]): PlanPhase | null {
  return phases.find((phase) => phase.current) ?? null;
}
