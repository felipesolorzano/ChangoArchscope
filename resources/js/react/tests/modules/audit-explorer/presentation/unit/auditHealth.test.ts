import { describe, expect, it } from "vitest";

import { checkStatus, healthBarSegments, healthLabel, healthSummaryText } from "../../../../../modules/audit-explorer/presentation/constants/auditHealth";
import { toneFill } from "../../../../../modules/audit-explorer/presentation/constants/auditView";

describe("salud: helpers puros", () => {
  it("toneFill(none) es verde (sano)", () => {
    expect(toneFill("none")).toBe("#16a34a");
  });

  it("healthBarSegments: verde sanos y rojo con hallazgos, solo los que hay", () => {
    expect(healthBarSegments({ files: 4, withFindings: 1 })).toEqual([
      { key: "healthy", percent: 75, color: "#16a34a" },
      { key: "withFindings", percent: 25, color: "#dc2626" },
    ]);
    expect(healthBarSegments({ files: 3, withFindings: 0 })).toEqual([{ key: "healthy", percent: 100, color: "#16a34a" }]);
    expect(healthBarSegments({ files: 2, withFindings: 2 })).toEqual([{ key: "withFindings", percent: 100, color: "#dc2626" }]);
    expect(healthBarSegments({ files: 0, withFindings: 0 })).toEqual([]);
  });

  it("healthLabel", () => {
    expect(healthLabel({ files: 0, withFindings: 0 })).toBe("");
    expect(healthLabel({ files: 12, withFindings: 0 })).toBe("✓ 12 sanos");
    expect(healthLabel({ files: 18, withFindings: 3 })).toBe("3 de 18 con hallazgos");
  });

  it("healthSummaryText", () => {
    expect(healthSummaryText({ files: 79, healthy: 74, withFindings: 5, healthyPercent: 94 })).toBe("79 archivos · 74 sanos · 5 con hallazgos");
  });

  it("checkStatus", () => {
    expect(checkStatus(0)).toEqual({ ok: true, text: "✓" });
    expect(checkStatus(26)).toEqual({ ok: false, text: "26" });
  });
});
