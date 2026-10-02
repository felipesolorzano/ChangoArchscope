import type { PlanTaskState } from "../../domain/value-objects/Plan.js";

// Estado de las tareas por stack (`target`): el mismo plan de Laravel y de React avanza por separado.
export interface PlanTaskStateRepository {
  getStates(target: string): Record<string, PlanTaskState>;
  setState(target: string, taskKey: string, state: PlanTaskState): void;
}
