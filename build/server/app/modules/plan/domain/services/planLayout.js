export const STAGE_X = 320;
export const ROW_Y = 250;
// Una tarea sin fase va despues de todas.
const NO_PHASE = Number.MAX_SAFE_INTEGER;
// XRay X6: una columna por fase con tareas (sin huecos), en el orden del flujo; filas en orden de roadmap.
export function planLayout(tasks, phaseOf) {
    const phaseOfTask = (key) => phaseOf[key] ?? NO_PHASE;
    const columns = [...new Set(tasks.map((task) => phaseOfTask(task.key)))].sort((left, right) => left - right);
    const stages = {};
    const positions = {};
    const rowByStage = {};
    for (const task of tasks) {
        const stage = columns.indexOf(phaseOfTask(task.key));
        const row = rowByStage[stage] ?? 0;
        rowByStage[stage] = row + 1;
        stages[task.key] = stage;
        positions[task.key] = { x: stage * STAGE_X, y: row * ROW_Y };
    }
    return { stages, positions };
}
