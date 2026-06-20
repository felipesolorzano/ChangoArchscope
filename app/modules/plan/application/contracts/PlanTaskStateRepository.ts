import type { PlanTaskState } from "../../domain/value-objects/Plan.js";

export interface PlanTaskStateRepository {
  getStates(): Record<string, PlanTaskState>;
  setState(taskKey: string, state: PlanTaskState): void;
}
