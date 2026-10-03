import { describe, expect, it } from "vitest";

import type { PlanPhase, PlanTask } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { buildPlanGraph } from "../../../../../app/modules/plan/domain/services/buildPlanGraph.js";

const phase = (number: number, taskKeys: string[], over: Partial<PlanPhase> = {}): PlanPhase => ({
  number,
  key: `p${number}`,
  title: `Fase ${number}`,
  goal: "",
  status: "failed",
  current: false,
  gates: [],
  tasks: taskKeys,
  ...over,
});

const tasks: PlanTask[] = [
  { key: "a", title: "A", description: "da", category: "security", dependsOn: [], metric: 10 },
  { key: "b", title: "B", description: "db", category: "database", dependsOn: ["a"], metric: 5 },
];

describe("buildPlanGraph", () => {
  it("crea un nodo por tarea con su estado (default pending) y posicion", () => {
    const graph = buildPlanGraph(tasks, { a: "done" }, "2026-01-01T00:00:00.000Z", [phase(1, ["a"]), phase(3, ["b"])]);

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

  it("lanes: un encabezado por fase con tareas, con su x (XRay X6)", () => {
    const graph = buildPlanGraph(tasks, {}, "2026-01-01T00:00:00.000Z", [phase(0, []), phase(1, ["a"], { title: "Limpieza", status: "passed" }), phase(3, ["b"], { current: true })]);

    expect(graph.lanes).toEqual([
      { phase: 1, title: "Limpieza", status: "passed", current: false, x: 0 },
      { phase: 3, title: "Fase 3", status: "failed", current: true, x: 320 },
    ]);
    expect(buildPlanGraph(tasks, {}, "2026-01-01T00:00:00.000Z").lanes).toEqual([]);
  });

  it("flechas: reduccion transitiva de las dependencias (XRay X6)", () => {
    const chain: PlanTask[] = [
      { key: "a", title: "A", description: "", category: "x", dependsOn: [], metric: 1 },
      { key: "b", title: "B", description: "", category: "x", dependsOn: ["a"], metric: 1 },
      // "y" y "x" no son tareas del plan: no tienen flecha y la busqueda las salta.
      { key: "c", title: "C", description: "", category: "x", dependsOn: ["y", "a", "b"], metric: 1 },
      { key: "d", title: "D", description: "", category: "x", dependsOn: ["a", "c", "x"], metric: 1 },
      { key: "e", title: "E", description: "", category: "x", dependsOn: ["a"], metric: 1 },
    ];

    expect(buildPlanGraph(chain, {}, "2026-01-01T00:00:00.000Z").edges.map((edge) => edge.id)).toEqual(["dep:a:b", "dep:b:c", "dep:c:d", "dep:a:e"]);
  });

  it("lockReason por nodo con los estados (XRay X6)", () => {
    const graph = buildPlanGraph(tasks, {}, "2026-01-01T00:00:00.000Z", [phase(1, ["a"]), phase(3, ["b"])]);

    expect(graph.nodes.map((node) => [node.id, node.lockReason])).toEqual([
      ["a", null],
      ["b", "Espera a: A"],
    ]);
    expect(buildPlanGraph(tasks, { a: "done" }, "2026-01-01T00:00:00.000Z").nodes[1].lockReason).toBeNull();
  });
});
