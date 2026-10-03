import type { PlanGate, PlanPhase, PlanPhaseStatus, PlanTaskState } from "../../domain/value-objects/PlanGraph";
import { stateColor } from "./planView";

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

/** Minimapa del grafo: los encabezados de fase por su estado, las tareas por el suyo. */
export function minimapNodeColor(node: { type?: string; data: unknown }): string {
  return node.type === "planLane" ? phaseStatusColor((node.data as { status: PlanPhaseStatus }).status) : stateColor((node.data as { state: PlanTaskState }).state);
}

/** XRay X6: el hotfix (fase -1) es un carril aparte: se muestra sin numero. */
export function phaseHeading(phase: Pick<PlanPhase, "number" | "title">): string {
  return phase.number < 0 ? phase.title : `${phase.number}. ${phase.title}`;
}

export function laneLabel(phase: number): string {
  return phase < 0 ? "Hotfix" : `Fase ${phase}`;
}
