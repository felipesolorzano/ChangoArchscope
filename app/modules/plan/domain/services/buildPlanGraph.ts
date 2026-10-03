import type { PlanGraph, PlanGraphEdge, PlanGraphNode, PlanLane, PlanPhase, PlanTask, PlanTaskState } from "../value-objects/Plan.js";
import { STAGE_X, planLayout } from "./planLayout.js";
import { planLocks } from "./planLocks.js";

// Grafo de tareas en columnas por fase (XRay X6); los checks y las fases los agrega buildPlan.
export function buildPlanGraph(
  tasks: PlanTask[],
  states: Record<string, PlanTaskState>,
  generatedAt: string,
  phases: PlanPhase[] = [],
): Omit<PlanGraph, "checks" | "phases"> {
  const phaseOf = Object.fromEntries(phases.flatMap((phase) => phase.tasks.map((task) => [task, phase.number])));
  const { stages, positions } = planLayout(tasks, phaseOf);
  const locks = planLocks({ tasks, phases, states });

  const nodes: PlanGraphNode[] = tasks.map((task) => ({
    id: task.key,
    title: task.title,
    description: task.description,
    category: task.category,
    state: states[task.key] ?? "pending",
    metric: task.metric,
    stage: stages[task.key],
    position: positions[task.key],
    lockReason: locks[task.key],
  }));

  const byState: Record<string, number> = {};
  for (const node of nodes) {
    byState[node.state] = (byState[node.state] ?? 0) + 1;
  }

  return {
    generated_at: generatedAt,
    summary: { tasks: nodes.length, by_state: byState },
    lanes: lanesOf(phases, tasks, stages),
    nodes,
    edges: reducedEdges(tasks),
  };
}

// Un encabezado por fase que tiene tareas en el grafo, sobre su columna.
function lanesOf(phases: PlanPhase[], tasks: PlanTask[], stages: Record<string, number>): PlanLane[] {
  const present = new Set(tasks.map((task) => task.key));

  return phases.flatMap((phase) => {
    const first = phase.tasks.find((task) => present.has(task));
    return first === undefined ? [] : [{ phase: phase.number, title: phase.title, status: phase.status, current: phase.current, x: stages[first] * STAGE_X }];
  });
}

// Reduccion transitiva: una flecha A→C sobra si C ya llega a A por otra dependencia (A→B→C).
// El plan es un DAG (cada tarea depende de tareas anteriores del roadmap): la busqueda termina.
function reducedEdges(tasks: PlanTask[]): PlanGraphEdge[] {
  const dependsOn = new Map(tasks.map((task) => [task.key, task.dependsOn]));
  const reaches = (from: string, target: string): boolean => (dependsOn.get(from) ?? []).some((next) => next === target || reaches(next, target));

  return tasks.flatMap((task) => {
    const direct = task.dependsOn.filter((dependency) => dependsOn.has(dependency));
    return direct
      .filter((dependency) => !direct.some((other) => reaches(other, dependency)))
      .map((dependency) => ({ id: `dep:${dependency}:${task.key}`, source: dependency, target: task.key }));
  });
}
