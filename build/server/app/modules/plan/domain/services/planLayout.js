export const STAGE_X = 320;
export const ROW_Y = 170;
export function planLayout(tasks) {
    const byKey = new Map(tasks.map((task) => [task.key, task]));
    const stages = {};
    const stageOf = (key, seen) => {
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
    const rowByStage = {};
    const positions = {};
    for (const task of tasks) {
        const stage = stages[task.key];
        const row = rowByStage[stage] ?? 0;
        rowByStage[stage] = row + 1;
        positions[task.key] = { x: stage * STAGE_X, y: row * ROW_Y };
    }
    return { stages, positions };
}
