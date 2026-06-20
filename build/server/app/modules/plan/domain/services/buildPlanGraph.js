import { planLayout } from "./planLayout.js";
export function buildPlanGraph(tasks, states, generatedAt) {
    const { stages, positions } = planLayout(tasks);
    const nodes = tasks.map((task) => ({
        id: task.key,
        title: task.title,
        description: task.description,
        category: task.category,
        state: states[task.key] ?? "pending",
        metric: task.metric,
        stage: stages[task.key],
        position: positions[task.key],
    }));
    const edges = tasks.flatMap((task) => task.dependsOn.map((dependency) => ({ id: `dep:${dependency}:${task.key}`, source: dependency, target: task.key })));
    const byState = {};
    for (const node of nodes) {
        byState[node.state] = (byState[node.state] ?? 0) + 1;
    }
    return {
        generated_at: generatedAt,
        summary: { tasks: nodes.length, by_state: byState },
        nodes,
        edges,
    };
}
