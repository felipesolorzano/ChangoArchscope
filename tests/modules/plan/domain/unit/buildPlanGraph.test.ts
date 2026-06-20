import { describe, expect, it } from "vitest";

import type { PlanTask } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { buildPlanGraph } from "../../../../../app/modules/plan/domain/services/buildPlanGraph.js";

const tasks: PlanTask[] = [
  { key: "a", title: "A", description: "da", category: "security", dependsOn: [], metric: 10 },
  { key: "b", title: "B", description: "db", category: "database", dependsOn: ["a"], metric: 5 },
];

describe("buildPlanGraph", () => {
  it("crea un nodo por tarea con su estado (default pending) y posicion", () => {
    const graph = buildPlanGraph(tasks, { a: "done" }, "2026-01-01T00:00:00.000Z");

    const a = graph.nodes.find((node) => node.id === "a");
    const b = graph.nodes.find((node) => node.id === "b");

    expect(a?.state).toBe("done");
    expect(b?.state).toBe("pending");
    expect(a?.stage).toBe(0);
    expect(b?.stage).toBe(1);
    expect(b?.position.x).toBeGreaterThan(a?.position.x ?? 0);
  });

  it("crea un edge por cada dependencia", () => {
    const graph = buildPlanGraph(tasks, {}, "2026-01-01T00:00:00.000Z");

    expect(graph.edges).toEqual([{ id: "dep:a:b", source: "a", target: "b" }]);
  });

  it("summary cuenta tareas por estado", () => {
    const graph = buildPlanGraph(tasks, { a: "done", b: "in_progress" }, "2026-01-01T00:00:00.000Z");

    expect(graph.summary.tasks).toBe(2);
    expect(graph.summary.by_state).toEqual({ done: 1, in_progress: 1 });
  });

  it("sin tareas produce un grafo vacio", () => {
    const graph = buildPlanGraph([], {}, "2026-01-01T00:00:00.000Z");

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.summary).toEqual({ tasks: 0, by_state: {} });
  });
});
