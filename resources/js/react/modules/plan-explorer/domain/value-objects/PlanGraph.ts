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

export interface PlanGraph {
  generated_at: string;
  summary: { tasks: number; by_state: Record<string, number> };
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
