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

/** XRay X6: no se empieza (ni se da por hecha) una tarea que el flujo todavia bloquea o que no esta en el plan. */
export function assertTaskUnlocked(graph: Pick<PlanGraph, "nodes">, taskKey: string, state: string): void {
  if (!STARTING_STATES.has(state)) {
    return;
  }
  const node = graph.nodes.find((candidate) => candidate.id === taskKey);

  // Sin la tarea en el plan (p. ej. el reporte de dependencias no cargo) no se puede validar su orden.
  if (node === undefined) {
    throw new Error(`La tarea "${taskKey}" no esta en el plan actual: no se puede empezar ni dar por hecha.`);
  }
  if (node.lockReason !== null) {
    throw new Error(`La tarea "${node.title}" esta bloqueada. ${node.lockReason}.`);
  }
}
