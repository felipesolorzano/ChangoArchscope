import { PLAN_TASK_STATES, type PlanGraph, type PlanTaskState } from "../../domain/value-objects/Plan.js";
import type { PlanTaskStateRepository } from "../contracts/PlanTaskStateRepository.js";

export function updateTaskState(
  repository: PlanTaskStateRepository,
  target: string,
  project: string,
  taskKey: string,
  state: string,
): PlanTaskState {
  if (!isPlanTaskState(state)) {
    throw new Error(`Invalid task state "${state}". Use one of: ${PLAN_TASK_STATES.join(", ")}.`);
  }

  if (taskKey.length === 0) {
    throw new Error("taskKey is required.");
  }

  repository.setState(target, project, taskKey, state);

  return state;
}

function isPlanTaskState(value: string): value is PlanTaskState {
  return (PLAN_TASK_STATES as string[]).includes(value);
}

const STARTING_STATES = new Set(["in_progress", "done"]);

/** XRay X6: no se empieza (ni se da por hecha) una tarea que el flujo todavia bloquea. */
export function assertTaskUnlocked(graph: Pick<PlanGraph, "nodes">, taskKey: string, state: string): void {
  const node = graph.nodes.find((candidate) => candidate.id === taskKey);

  if (node?.lockReason != null && STARTING_STATES.has(state)) {
    throw new Error(`La tarea "${node.title}" esta bloqueada. ${node.lockReason}.`);
  }
}
