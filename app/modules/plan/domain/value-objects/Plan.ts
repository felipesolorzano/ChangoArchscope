export type PlanTaskState = "pending" | "in_progress" | "done" | "blocked";

export const PLAN_TASK_STATES: PlanTaskState[] = ["pending", "in_progress", "done", "blocked"];

// Señales que el generador necesita del audit. El modulo `plan` no depende del dominio de
// `audit`: un adaptador en la capa de aplicacion traduce el AuditSnapshot a estas señales.
export type PlanSignals = {
  ruleCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  duplicatePairs: number;
  skippedFiles: number;
};

// Tarea derivada (plantilla): estructura sin estado.
export type PlanTask = {
  key: string;
  title: string;
  description: string;
  category: string;
  dependsOn: string[];
  metric: number;
};

// Nodo del grafo del plan (tarea + estado + posicion para React Flow).
export type PlanGraphNode = {
  id: string;
  title: string;
  description: string;
  category: string;
  state: PlanTaskState;
  metric: number;
  stage: number;
  position: { x: number; y: number };
};

export type PlanGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type PlanGraph = {
  generated_at: string;
  summary: { tasks: number; by_state: Record<string, number> };
  nodes: PlanGraphNode[];
  edges: PlanGraphEdge[];
};

// Hallazgo concreto que respalda una tarea del plan (puente plan -> audit).
export type PlanFinding = {
  file: string;
  line: number;
  rule: string;
  severity: string;
  message: string;
};

export type PlanTaskFindings = {
  taskKey: string;
  total: number;
  items: PlanFinding[];
};
