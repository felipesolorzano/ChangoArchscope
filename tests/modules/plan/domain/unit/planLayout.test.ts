import { describe, expect, it } from "vitest";

import type { PlanTask } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { ROW_Y, STAGE_X, planLayout } from "../../../../../app/modules/plan/domain/services/planLayout.js";

function task(key: string, dependsOn: string[] = []): PlanTask {
  return { key, title: key, description: "", category: "x", dependsOn, metric: 1 };
}

describe("planLayout (columnas por fase, XRay X6)", () => {
  it("columna = posicion de la fase entre las fases con tareas (sin huecos); fila en orden de roadmap", () => {
    const { stages, positions } = planLayout([task("a"), task("b", ["a"]), task("c"), task("d")], { a: 2, b: 7, c: 2, d: 0 });

    expect(stages).toEqual({ a: 1, b: 2, c: 1, d: 0 });
    expect(positions).toEqual({ a: { x: STAGE_X, y: 0 }, b: { x: 2 * STAGE_X, y: 0 }, c: { x: STAGE_X, y: ROW_Y }, d: { x: 0, y: 0 } });
    expect([STAGE_X, ROW_Y]).toEqual([320, 250]);
  });

  it("una tarea sin fase va a una columna final", () => {
    expect(planLayout([task("x"), task("a")], { a: 5 }).stages).toEqual({ x: 1, a: 0 });
  });

  it("sin tareas devuelve mapas vacios", () => {
    expect(planLayout([], {})).toEqual({ stages: {}, positions: {} });
  });
});
