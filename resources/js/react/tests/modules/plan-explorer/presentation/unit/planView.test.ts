import { describe, expect, it } from "vitest";

import { PLAN_STATE_OPTIONS, stateColor, stateLabel } from "../../../../../modules/plan-explorer/presentation/constants/planView";

describe("stateColor", () => {
  it("devuelve un color por cada estado", () => {
    for (const state of ["pending", "in_progress", "done", "blocked"] as const) {
      expect(stateColor(state)).toMatch(/^#|rgb/);
    }
  });

  it("done y blocked tienen colores distintos", () => {
    expect(stateColor("done")).not.toBe(stateColor("blocked"));
  });

  it("un estado desconocido cae al color de pending", () => {
    expect(stateColor("???" as never)).toBe(stateColor("pending"));
  });
});

describe("stateLabel", () => {
  it("traduce cada estado a una etiqueta legible", () => {
    expect(stateLabel("in_progress")).toBe("En progreso");
    expect(stateLabel("done")).toBe("Hecho");
  });
});

describe("PLAN_STATE_OPTIONS", () => {
  it("expone los 4 estados en orden", () => {
    expect(PLAN_STATE_OPTIONS.map((option) => option.state)).toEqual(["pending", "in_progress", "done", "blocked"]);
  });
});
