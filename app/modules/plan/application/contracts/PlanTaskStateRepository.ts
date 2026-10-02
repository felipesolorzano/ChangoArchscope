import type { PlanTaskState } from "../../domain/value-objects/Plan.js";

// Estado de las tareas por stack (`target`) y proyecto (raiz del stack): el plan de cada uno avanza
// por separado.
export interface PlanTaskStateRepository {
  getStates(target: string, project: string): Record<string, PlanTaskState>;
  setState(target: string, project: string, taskKey: string, state: PlanTaskState): void;
}
