import type { PlanTask } from "../value-objects/Plan.js";

export const STAGE_X = 320;
export const ROW_Y = 170;

export type PlanLayout = {
  stages: Record<string, number>;
  positions: Record<string, { x: number; y: number }>;
};

export function planLayout(tasks: PlanTask[]): PlanLayout {
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const stages: Record<string, number> = {};

  const stageOf = (key: string, seen: Set<string>): number => {
    if (stages[key] !== undefined) {
      return stages[key];
    }

    const task = byKey.get(key);

    if (task === undefined || task.dependsOn.length === 0 || seen.has(key)) {
      stages[key] = 0;
      return 0;
    }

    const next = new Set(seen).add(key);
    const stage = 1 + Math.max(...task.dependsOn.map((dependency) => stageOf(dependency, next)));
    stages[key] = stage;

    return stage;
  };

  for (const task of tasks) {
    stageOf(task.key, new Set());
  }

  const rowByStage: Record<number, number> = {};
  const positions: Record<string, { x: number; y: number }> = {};

  for (const task of tasks) {
    const stage = stages[task.key];
    const row = rowByStage[stage] ?? 0;
    rowByStage[stage] = row + 1;
    positions[task.key] = { x: stage * STAGE_X, y: row * ROW_Y };
  }

  return { stages, positions };
}
