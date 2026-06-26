import { describe, expect, it } from "vitest";

import {
  accentStroke,
  severityBarSegments,
  toneFill,
} from "../../../../../modules/audit-explorer/presentation/constants/auditView";

describe("toneFill", () => {
  it("devuelve un color por cada tono", () => {
    for (const tone of ["critical", "high", "medium", "low", "none"] as const) {
      expect(toneFill(tone)).toMatch(/^#|rgb/);
    }
  });

  it("critical y high no comparten color con low", () => {
    expect(toneFill("critical")).not.toBe(toneFill("low"));
    expect(toneFill("high")).not.toBe(toneFill("low"));
  });

  it("un tono desconocido cae al color de 'none'", () => {
    expect(toneFill("???" as never)).toBe(toneFill("none"));
  });
});

describe("accentStroke", () => {
  it("devuelve un color por cada accent conocido", () => {
    for (const accent of ["security", "database", "complexity", "testing", "dead_code", "coupling_low_level", "php_compatibility", "mixed"] as const) {
      expect(accentStroke(accent)).toMatch(/^#|rgb/);
    }
  });

  it("security y database tienen colores distintos", () => {
    expect(accentStroke("security")).not.toBe(accentStroke("database"));
  });

  it("php_compatibility tiene su propio color, distinto de 'mixed'", () => {
    expect(accentStroke("php_compatibility")).not.toBe(accentStroke("mixed"));
  });

  it("un accent desconocido cae al color de 'mixed'", () => {
    expect(accentStroke("???" as never)).toBe(accentStroke("mixed"));
  });
});

describe("severityBarSegments", () => {
  it("devuelve porcentajes proporcionales que suman 100", () => {
    const segments = severityBarSegments({ high: 1, medium: 1, low: 2 });
    const total = segments.reduce((sum, segment) => sum + segment.percent, 0);

    expect(Math.round(total)).toBe(100);
    expect(segments.map((segment) => segment.key)).toEqual(["high", "medium", "low"]);
  });

  it("mezcla en cero devuelve lista vacia", () => {
    expect(severityBarSegments({ high: 0, medium: 0, low: 0 })).toEqual([]);
  });

  it("omite los segmentos con conteo cero", () => {
    const segments = severityBarSegments({ high: 3, medium: 0, low: 1 });

    expect(segments.map((segment) => segment.key)).toEqual(["high", "low"]);
  });
});
