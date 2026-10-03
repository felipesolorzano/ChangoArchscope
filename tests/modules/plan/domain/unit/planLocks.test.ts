import { describe, expect, it } from "vitest";

import { planLocks } from "../../../../../app/modules/plan/domain/services/planLocks.js";
import type { PlanPhase, PlanTask } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";

const task = (key: string, dependsOn: string[] = []): PlanTask => ({ key, title: key.toUpperCase(), description: "", category: "x", dependsOn, metric: 1 });
const phase = (number: number, tasks: string[], status: PlanPhase["status"] = "failed"): PlanPhase => ({ number, key: `p${number}`, title: `Fase${number}`, goal: "", status, current: false, gates: [], tasks });

describe("planLocks (XRay X6)", () => {
  it("por dependencias sin hacer y por fase abierta; las dependencias ganan", () => {
    const tasks = [task("a"), task("b", ["a"]), task("c"), task("d", ["c", "a"]), task("e")];
    const phases = [phase(1, ["a", "b"]), phase(2, ["c", "d"]), phase(3, ["e"])];

    expect(planLocks({ tasks, phases, states: { b: "done" } })).toEqual({
      a: null,
      b: "Espera a: A",
      c: "Hasta cerrar la fase 1 · Fase1",
      d: "Espera a: C, A",
      e: "Hasta cerrar la fase 1 · Fase1",
    });
  });

  it("una fase se cierra por gates, por no aplicar, sin tareas en el plan o con todas sus tareas hechas", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const phases = [phase(0, ["a"], "passed"), phase(1, [], "failed"), phase(2, ["b"], "not-applicable"), phase(3, ["c"], "failed"), phase(4, ["z"], "failed"), phase(5, ["y"], "unknown")];

    expect(planLocks({ tasks, phases, states: {} })).toEqual({ a: null, b: null, c: null });
    // Con c hecha la fase 3 se cierra; la 4 y la 5 (sin tareas del plan) no bloquean.
    const later = [...tasks, task("x")];
    expect(planLocks({ tasks: later, phases: [...phases, phase(6, ["x"])], states: { c: "done" } }).x).toBeNull();
    expect(planLocks({ tasks: later, phases: [...phases, phase(6, ["x"])], states: { c: "in_progress" } }).x).toBe("Hasta cerrar la fase 3 · Fase3");
  });

  it("muestra hasta 3 dependencias y cuantas faltan", () => {
    const tasks = [task("a"), task("b"), task("c"), task("d"), task("e"), task("v", ["a", "b", "c", "d", "e"]), task("w", ["a", "b", "c"])];

    expect(planLocks({ tasks, phases: [], states: { e: "done" } })).toMatchObject({ v: "Espera a: A, B, C (+1)", w: "Espera a: A, B, C" });
  });

  it("con todas las fases cerradas no hay fase abierta", () => {
    expect(planLocks({ tasks: [task("a"), task("b")], phases: [phase(1, ["a"], "passed"), phase(2, ["b"], "failed")], states: { b: "done" } })).toEqual({ a: null, b: null });
  });

  it("una tarea sin fase solo se bloquea por dependencias; una dependencia fuera del plan no cuenta", () => {
    const tasks = [task("a"), task("free"), task("dep", ["a", "ghost"])];

    expect(planLocks({ tasks, phases: [phase(1, ["a"])], states: {} })).toEqual({ a: null, free: null, dep: "Espera a: A" });
  });
});
