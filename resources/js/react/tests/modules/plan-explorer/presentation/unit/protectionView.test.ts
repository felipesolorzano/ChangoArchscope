import { describe, expect, it } from "vitest";

import { protectionLevelColor, protectionLevelLabel, protectionParts } from "../../../../../modules/plan-explorer/presentation/constants/protectionView";
import type { ProtectionBaseline } from "../../../../../modules/plan-explorer/domain/value-objects/Protection";

const baseline = (overrides: Partial<ProtectionBaseline> = {}): ProtectionBaseline => ({
  root: "/p",
  tests: { testFiles: 0, sourceFiles: 269 },
  coverage: null,
  mutation: null,
  e2e: null,
  level: "none",
  ...overrides,
});

describe("protectionView", () => {
  it("etiqueta y color por nivel", () => {
    const levels = ["none", "low", "medium", "high"] as const;

    expect(levels.map(protectionLevelLabel)).toEqual(["Ninguna", "Baja", "Media", "Alta"]);
    expect(levels.map(protectionLevelColor)).toEqual(["#dc2626", "#ea580c", "#ca8a04", "#16a34a"]);
  });

  it("partes sin reportes", () => {
    expect(protectionParts(baseline())).toEqual(["0 archivos de test · 269 fuente", "Cobertura: sin reporte", "Mutation: sin reporte", "E2E: sin reporte"]);
  });

  it("partes con reportes", () => {
    const full = baseline({
      tests: { testFiles: 40, sourceFiles: 100 },
      coverage: { percent: 86, covered: 86, total: 100, reports: [] },
      mutation: { score: 74, killed: 74, survived: 26, timeout: 0, noCoverage: 0, reports: [] },
      e2e: { passed: 22, failed: 1, reports: [] },
      level: "high",
    });

    expect(protectionParts(full)).toEqual(["40 archivos de test · 100 fuente", "Cobertura 86%", "Mutation 74%", "E2E 22/23"]);
  });
});
