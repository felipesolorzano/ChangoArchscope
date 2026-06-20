import { describe, expect, it } from "vitest";

import type { PlanTask } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { STAGE_X, planLayout } from "../../../../../app/modules/plan/domain/services/planLayout.js";

function task(key: string, dependsOn: string[] = []): PlanTask {
  return { key, title: key, description: "", category: "x", dependsOn, metric: 1 };
}

describe("planLayout", () => {
  it("asigna stage = profundidad maxima de dependencias", () => {
    const { stages } = planLayout([task("a"), task("b", ["a"]), task("c", ["a", "b"]), task("v", ["a", "b", "c"])]);

    expect(stages).toEqual({ a: 0, b: 1, c: 2, v: 3 });
  });

  it("posiciona por stage en columnas (x = stage * STAGE_X)", () => {
    const { positions } = planLayout([task("a"), task("b", ["a"])]);

    expect(positions.a.x).toBe(0);
    expect(positions.b.x).toBe(STAGE_X);
  });

  it("dos tareas en el mismo stage reciben y distintos", () => {
    const { positions } = planLayout([task("a"), task("b")]);

    expect(positions.a.x).toBe(0);
    expect(positions.b.x).toBe(0);
    expect(positions.a.y).not.toBe(positions.b.y);
  });

  it("sin tareas devuelve mapas vacios", () => {
    expect(planLayout([])).toEqual({ stages: {}, positions: {} });
  });
});
