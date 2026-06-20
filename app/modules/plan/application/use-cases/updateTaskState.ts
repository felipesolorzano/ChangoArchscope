import { PLAN_TASK_STATES, type PlanTaskState } from "../../domain/value-objects/Plan.js";
import type { PlanTaskStateRepository } from "../contracts/PlanTaskStateRepository.js";

export function updateTaskState(repository: PlanTaskStateRepository, taskKey: string, state: string): PlanTaskState {
  if (!isPlanTaskState(state)) {
    throw new Error(`Invalid task state "${state}". Use one of: ${PLAN_TASK_STATES.join(", ")}.`);
  }

  if (taskKey.length === 0) {
    throw new Error("taskKey is required.");
  }

  repository.setState(taskKey, state);

  return state;
}

function isPlanTaskState(value: string): value is PlanTaskState {
  return (PLAN_TASK_STATES as string[]).includes(value);
}
