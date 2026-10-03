import type { PlanPhase, PlanTask, PlanTaskState } from "../value-objects/Plan.js";

export type PlanLocksInput = { tasks: PlanTask[]; phases: PlanPhase[]; states: Record<string, PlanTaskState> };

const CLEARED_STATUSES = new Set<PlanPhase["status"]>(["passed", "not-applicable"]);
const SHOWN_TITLES = 3;

// XRay X6: por que no se puede empezar cada tarea todavia (null = se puede). Spec: plan-phases.md.
export function planLocks({ tasks, phases, states }: PlanLocksInput): Record<string, string | null> {
  const titles = new Map(tasks.map((task) => [task.key, task.title]));
  const isDone = (key: string) => states[key] === "done";
  const phaseOf = new Map(phases.flatMap((phase) => phase.tasks.map((key) => [key, phase])));
  // Fase abierta: la primera que no se cerro por gates, por no tener tareas (every de [] es true) o
  // por tener todas sus tareas hechas.
  const open = phases.find((phase) => !CLEARED_STATUSES.has(phase.status) && !phase.tasks.filter((key) => titles.has(key)).every(isDone));

  return Object.fromEntries(
    tasks.map((task) => {
      const waiting = task.dependsOn.filter((key) => titles.has(key) && !isDone(key));
      if (waiting.length > 0) {
        const rest = waiting.length - SHOWN_TITLES;
        return [task.key, `Espera a: ${waiting.slice(0, SHOWN_TITLES).map((key) => titles.get(key)).join(", ")}${rest > 0 ? ` (+${rest})` : ""}`];
      }
      const phase = phaseOf.get(task.key);
      return [task.key, open !== undefined && phase !== undefined && phase.number > open.number ? `Hasta cerrar la fase ${open.number} · ${open.title}` : null];
    }),
  );
}

/** XRay X6: la tarea recomendada: terminar lo empezado, si no la primera pendiente que se puede empezar. */
export function planNextTask(tasks: PlanTask[], locks: Record<string, string | null>, states: Record<string, PlanTaskState>): string | null {
  const available = tasks.filter((task) => locks[task.key] === null);
  const inState = (state: PlanTaskState) => available.find((task) => (states[task.key] ?? "pending") === state);

  return (inState("in_progress") ?? inState("pending"))?.key ?? null;
}
