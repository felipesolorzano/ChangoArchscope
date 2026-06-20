import { describe, expect, it } from "vitest";

import type { PlanSignals } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { generatePlan } from "../../../../../app/modules/plan/domain/services/generatePlan.js";

function signals(over: Partial<PlanSignals> = {}): PlanSignals {
  return { ruleCounts: {}, categoryCounts: {}, duplicatePairs: 0, skippedFiles: 0, ...over };
}

describe("generatePlan", () => {
  it("deriva tareas solo para las senales presentes (metric > 0)", () => {
    const plan = generatePlan(
      signals({
        ruleCounts: { "sql-concatenation": 104, "untested-complex-method": 300 },
        skippedFiles: 6,
      }),
    );

    expect(plan.map((task) => task.key).sort()).toEqual([
      "add-characterization-tests",
      "close-sql-injections",
      "exclude-third-party",
      "validate-risk-reduction",
    ]);
  });

  it("calcula la metrica de cada tarea desde las senales", () => {
    const plan = generatePlan(
      signals({ ruleCounts: { "raw-sql-outside-infrastructure": 1000, "duplicate-sql": 500, "n-plus-one-query": 200 } }),
    );

    const dataLayer = plan.find((task) => task.key === "extract-data-layer");
    const nPlusOne = plan.find((task) => task.key === "reduce-n-plus-one");

    expect(dataLayer?.metric).toBe(1500);
    expect(nPlusOne?.metric).toBe(200);
  });

  it("poda dependsOn a tareas incluidas; validate-risk-reduction depende de todas las demas", () => {
    const plan = generatePlan(signals({ ruleCounts: { "sql-concatenation": 10 } }));

    const validate = plan.find((task) => task.key === "validate-risk-reduction");
    const sql = plan.find((task) => task.key === "close-sql-injections");

    expect(sql?.dependsOn).toEqual([]); // su dep (tests) no esta incluida -> podada
    expect(validate?.dependsOn).toEqual(["close-sql-injections"]);
  });

  it("reduce-n-plus-one depende de los tests cuando ambos estan presentes", () => {
    const plan = generatePlan(
      signals({ ruleCounts: { "n-plus-one-query": 50, "untested-complex-method": 5 } }),
    );

    const nPlusOne = plan.find((task) => task.key === "reduce-n-plus-one");
    expect(nPlusOne?.dependsOn).toContain("add-characterization-tests");
  });

  it("senales vacias producen un plan vacio (ni siquiera validate)", () => {
    expect(generatePlan(signals())).toEqual([]);
  });
});
