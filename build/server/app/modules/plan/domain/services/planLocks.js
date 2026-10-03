const CLEARED_STATUSES = new Set(["passed", "not-applicable"]);
const SHOWN_TITLES = 3;
// XRay X6: por que no se puede empezar cada tarea todavia (null = se puede). Spec: plan-phases.md.
export function planLocks({ tasks, phases, states }) {
    const titles = new Map(tasks.map((task) => [task.key, task.title]));
    const isDone = (key) => states[key] === "done";
    const phaseOf = new Map(phases.flatMap((phase) => phase.tasks.map((key) => [key, phase])));
    // Fase abierta: la primera que no se cerro por gates, por no tener tareas (every de [] es true) o
    // por tener todas sus tareas hechas.
    // El hotfix (fase -1) es un carril paralelo: nunca es la fase abierta.
    const open = phases.find((phase) => phase.number >= 0 && !CLEARED_STATUSES.has(phase.status) && !phase.tasks.filter((key) => titles.has(key)).every(isDone));
    return Object.fromEntries(tasks.map((task) => {
        const waiting = task.dependsOn.filter((key) => titles.has(key) && !isDone(key));
        if (waiting.length > 0) {
            const rest = waiting.length - SHOWN_TITLES;
            return [task.key, `Espera a: ${waiting.slice(0, SHOWN_TITLES).map((key) => titles.get(key)).join(", ")}${rest > 0 ? ` (+${rest})` : ""}`];
        }
        const phase = phaseOf.get(task.key);
        return [task.key, open !== undefined && phase !== undefined && phase.number > open.number ? `Hasta cerrar la fase ${open.number} · ${open.title}` : null];
    }));
}
/** XRay X6: la tarea recomendada: terminar lo empezado, si no la primera pendiente que se puede empezar. */
export function planNextTask(tasks, locks, states) {
    const available = tasks.filter((task) => locks[task.key] === null);
    const inState = (state, candidates = available) => candidates.find((task) => (states[task.key] ?? "pending") === state);
    // Un hotfix sin hacer va antes que todo (XRay X6).
    const hotfix = available.filter((task) => task.key.startsWith("hotfix-"));
    return (inState("in_progress", hotfix) ?? inState("pending", hotfix) ?? inState("in_progress") ?? inState("pending"))?.key ?? null;
}
