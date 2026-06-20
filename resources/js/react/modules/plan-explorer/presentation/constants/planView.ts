import type { PlanTaskState } from "../../domain/value-objects/PlanGraph";

const STATE_COLOR: Record<PlanTaskState, string> = {
  pending: "#64748b",
  in_progress: "#3b82f6",
  done: "#22c55e",
  blocked: "#ef4444",
};

const STATE_LABEL: Record<PlanTaskState, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Hecho",
  blocked: "Bloqueado",
};

export type PlanStateOption = { state: PlanTaskState; label: string };

export const PLAN_STATE_OPTIONS: PlanStateOption[] = [
  { state: "pending", label: STATE_LABEL.pending },
  { state: "in_progress", label: STATE_LABEL.in_progress },
  { state: "done", label: STATE_LABEL.done },
  { state: "blocked", label: STATE_LABEL.blocked },
];

export function stateColor(state: PlanTaskState): string {
  return STATE_COLOR[state] ?? STATE_COLOR.pending;
}

export function stateLabel(state: PlanTaskState): string {
  return STATE_LABEL[state] ?? STATE_LABEL.pending;
}
