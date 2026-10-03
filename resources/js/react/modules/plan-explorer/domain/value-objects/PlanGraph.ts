export type PlanTaskState = "pending" | "in_progress" | "done" | "blocked";

export interface PlanGraphNode {
  id: string;
  title: string;
  description: string;
  category: string;
  state: PlanTaskState;
  metric: number;
  stage: number;
  position: { x: number; y: number };
}

export interface PlanGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface PlanCheck {
  category: string;
  label: string;
  findings: number;
}

export interface PlanGate {
  key: string;
  label: string;
  value: number | null;
  target: number;
  comparator: "max" | "min";
  format: "count" | "percent" | "level";
  status: "passed" | "failed" | "unknown";
}

export type PlanPhaseStatus = "passed" | "failed" | "unknown" | "not-applicable";

// Fase 0–10 con quality gates (XRay X6): se valida sola contra las metricas.
export interface PlanPhase {
  number: number;
  key: string;
  title: string;
  goal: string;
  status: PlanPhaseStatus;
  current: boolean;
  gates: PlanGate[];
  tasks: string[];
}

export interface PlanGraph {
  generated_at: string;
  summary: { tasks: number; by_state: Record<string, number> };
  checks?: PlanCheck[];
  phases?: PlanPhase[];
  /** Encabezado de cada columna del grafo (una por fase con tareas, XRay X6). */
  lanes?: PlanLane[];
  nodes: PlanGraphNode[];
  edges: PlanGraphEdge[];
}

export interface PlanFinding {
  file: string;
  line: number;
  rule: string;
  severity: string;
  message: string;
}

export interface PlanTaskFindings {
  taskKey: string;
  total: number;
  items: PlanFinding[];
}

export interface PlanLane {
  phase: number;
  title: string;
  status: PlanPhaseStatus;
  current: boolean;
  x: number;
}
