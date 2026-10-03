import type { PlanTask } from "../value-objects/Plan.js";

export const STAGE_X = 320;
export const ROW_Y = 250;
// Mas tareas que esto en una fase sigue en una sub-columna a la derecha.
export const MAX_ROWS = 5;

export type PlanLayout = {
  stages: Record<string, number>;
  positions: Record<string, { x: number; y: number }>;
};

// Una tarea sin fase va despues de todas.
const NO_PHASE = Number.MAX_SAFE_INTEGER;

// XRay X6: columnas por fase con tareas (sin huecos), en el orden del flujo; filas en orden de roadmap.
export function planLayout(tasks: PlanTask[], phaseOf: Record<string, number>): PlanLayout {
  const phaseOfTask = (key: string) => phaseOf[key] ?? NO_PHASE;
  const phases = [...new Set(tasks.map((task) => phaseOfTask(task.key)))].sort((left, right) => left - right);
  const byPhase = new Map(phases.map((phase) => [phase, tasks.filter((task) => phaseOfTask(task.key) === phase)]));
  const stages: Record<string, number> = {};
  const positions: Record<string, { x: number; y: number }> = {};
  let firstColumn = 0;

  for (const phase of phases) {
    const phaseTasks = byPhase.get(phase)!;
    phaseTasks.forEach((task, index) => {
      const stage = firstColumn + Math.floor(index / MAX_ROWS);
      stages[task.key] = stage;
      positions[task.key] = { x: stage * STAGE_X, y: (index % MAX_ROWS) * ROW_Y };
    });
    firstColumn += Math.ceil(phaseTasks.length / MAX_ROWS);
  }

  return { stages, positions };
}
