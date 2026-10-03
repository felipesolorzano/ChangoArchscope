import type { PlanTask } from "../value-objects/Plan.js";

export const STAGE_X = 320;
export const ROW_Y = 250;

export type PlanLayout = {
  stages: Record<string, number>;
  positions: Record<string, { x: number; y: number }>;
};

// Una tarea sin fase va despues de todas.
const NO_PHASE = Number.MAX_SAFE_INTEGER;

// XRay X6: una columna por fase con tareas (sin huecos), en el orden del flujo; filas en orden de roadmap.
export function planLayout(tasks: PlanTask[], phaseOf: Record<string, number>): PlanLayout {
  const phaseOfTask = (key: string) => phaseOf[key] ?? NO_PHASE;
  const columns = [...new Set(tasks.map((task) => phaseOfTask(task.key)))].sort((left, right) => left - right);
  const stages: Record<string, number> = {};
  const positions: Record<string, { x: number; y: number }> = {};
  const rowByStage: Record<number, number> = {};

  for (const task of tasks) {
    const stage = columns.indexOf(phaseOfTask(task.key));
    const row = rowByStage[stage] ?? 0;
    rowByStage[stage] = row + 1;
    stages[task.key] = stage;
    positions[task.key] = { x: stage * STAGE_X, y: row * ROW_Y };
  }

  return { stages, positions };
}
