import { describe, expect, it } from "vitest";

import { currentPhase, gateTarget, gateValue, laneLabel, minimapNodeColor, phaseHeading, phaseStatusColor, phaseStatusLabel } from "../../../../../modules/plan-explorer/presentation/constants/phaseView";
import { stateColor } from "../../../../../modules/plan-explorer/presentation/constants/planView";
import type { PlanGate, PlanPhase } from "../../../../../modules/plan-explorer/domain/value-objects/PlanGraph";

const gate = (overrides: Partial<PlanGate> = {}): PlanGate => ({ key: "g", label: "G", value: 3, target: 0, comparator: "max", format: "count", status: "failed", ...overrides });
const phase = (number: number, current: boolean): PlanPhase => ({ number, key: `p${number}`, title: `P${number}`, goal: "", status: "failed", current, gates: [], tasks: [] });

describe("phaseView (XRay X6)", () => {
  it("etiqueta y color por estado", () => {
    const statuses = ["passed", "failed", "unknown", "not-applicable"] as const;

    expect(statuses.map(phaseStatusLabel)).toEqual(["Cumplida", "Pendiente", "Sin datos", "No aplica"]);
    expect(statuses.map(phaseStatusColor)).toEqual(["#16a34a", "#dc2626", "#64748b", "#475569"]);
  });

  it("valor del gate segun formato; null es sin datos", () => {
    expect(gateValue(gate())).toBe("3");
    expect(gateValue(gate({ value: null }))).toBe("sin datos");
    expect(gateValue(gate({ value: 28, format: "percent" }))).toBe("28%");
    expect([0, 1, 2, 3].map((value) => gateValue(gate({ value, format: "level" })))).toEqual(["Ninguna", "Baja", "Media", "Alta"]);
  });

  it("objetivo del gate con su comparador y formato", () => {
    expect(gateTarget(gate())).toBe("≤ 0");
    expect(gateTarget(gate({ comparator: "min", target: 80, format: "percent" }))).toBe("≥ 80%");
    expect(gateTarget(gate({ comparator: "min", target: 1, format: "level" }))).toBe("≥ Baja");
  });

  it("fase actual o null", () => {
    expect(currentPhase([phase(0, false), phase(1, true)])?.number).toBe(1);
    expect(currentPhase([phase(0, false)])).toBeNull();
  });

  it("minimapa: encabezados por estado de fase, tareas por su estado", () => {
    expect(minimapNodeColor({ type: "planLane", data: { status: "passed" } })).toBe("#16a34a");
    expect(minimapNodeColor({ type: "planTask", data: { state: "done" } })).toBe(stateColor("done"));
  });

  it("el hotfix (fase -1) se muestra sin numero", () => {
    expect(phaseHeading(phase(3, false))).toBe("3. P3");
    expect(phaseHeading({ ...phase(-1, false), title: "Hotfix critico" })).toBe("Hotfix critico");
    expect([laneLabel(0), laneLabel(-1)]).toEqual(["Fase 0", "Hotfix"]);
  });
});

