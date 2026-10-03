export type PlanTaskState = "pending" | "in_progress" | "done" | "blocked";

export const PLAN_TASK_STATES: PlanTaskState[] = ["pending", "in_progress", "done", "blocked"];

// Señales que el generador necesita del audit. El modulo `plan` no depende del dominio de
// `audit`: un adaptador en la capa de aplicacion traduce el AuditSnapshot a estas señales.
export type PlanSignals = {
  /** Hallazgos por regla y severidad: `{ "untested-component": { high: 75, medium: 90 } }`. */
  findingCounts: Record<string, Record<string, number>>;
  categoryCounts: Record<string, number>;
  duplicatePairs: number;
  skippedFiles: number;
  /** Trabajo de actualizacion de paquetes (modulo dependencies): metrica e items por tarea. */
  dependencies?: DependencySignals;
  /** XRay X6: de los 10 archivos mas riesgosos, cuantos no tienen tests. Ausente = sin datos. */
  topRiskUntested?: number;
  /** XRay X6: porcentaje de archivos sin hallazgos (salud de Auditoria). Ausente = sin datos. */
  healthyPercent?: number;
  /** XRay X6: nivel de proteccion (X3); null o ausente = sin datos. */
  protectionLevel?: PlanProtectionLevel | null;
};

export type PlanProtectionLevel = "none" | "low" | "medium" | "high";

export type PlanStack = "laravel" | "react";

// Quality gate de una fase (XRay X6): se valida solo contra las metricas actuales.
export type PlanGate = {
  key: string;
  label: string;
  /** null = sin datos. */
  value: number | null;
  target: number;
  /** max: pasa si value <= target; min: pasa si value >= target. */
  comparator: "max" | "min";
  format: "count" | "percent" | "level";
  status: "passed" | "failed" | "unknown";
};

export type PlanPhase = {
  number: number;
  key: string;
  title: string;
  goal: string;
  status: "passed" | "failed" | "unknown" | "not-applicable";
  /** La primera fase no cumplida. */
  current: boolean;
  gates: PlanGate[];
  /** Tareas del plan que mueven sus gates. */
  tasks: string[];
};

export type DependencySignals = {
  counts: Record<string, number>;
  items: Record<string, PlanFinding[]>;
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
  /** Categorias auditadas del stack con su cantidad de hallazgos (para mostrar lo que esta en verde). */
  checks: PlanCheck[];
  /** Fases 0–10 con quality gates (XRay X6). */
  phases: PlanPhase[];
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

export type PlanCheck = { category: string; label: string; findings: number };
