import { describe, expect, it } from "vitest";

import {
  COL_GAP,
  GRID_CELL_X,
  GRID_CELL_Y,
  GRID_TOP_Y,
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
  ROW_Y,
  dominantAccent,
  foldSeverityMix,
  gridPositions,
  overviewPositions,
  sizeForRisk,
  toneForSeverity,
} from "../../../../../app/modules/audit/domain/services/auditGraphLayout.js";

describe("foldSeverityMix", () => {
  it("suma critical dentro de high y completa medium/low en cero cuando faltan", () => {
    expect(foldSeverityMix({ critical: 2, high: 3, medium: 1 })).toEqual({ high: 5, medium: 1, low: 0 });
  });

  it("un mix vacio es todo cero", () => {
    expect(foldSeverityMix({})).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

describe("dominantAccent", () => {
  it("devuelve la categoria con mayor peso", () => {
    expect(dominantAccent({ database: 10, security: 4, complexity: 2 })).toBe("database");
  });

  it("mapea una categoria desconocida (ej. architecture_violation) a 'mixed'", () => {
    expect(dominantAccent({ architecture_violation: 9 })).toBe("mixed");
  });

  it("reconoce php_compatibility como accent propio", () => {
    expect(dominantAccent({ php_compatibility: 12, security: 3 })).toBe("php_compatibility");
  });

  it("byCategory vacio es 'mixed'", () => {
    expect(dominantAccent({})).toBe("mixed");
  });
});

describe("toneForSeverity", () => {
  it("toma la severidad mas alta presente con conteo > 0", () => {
    expect(toneForSeverity({ low: 4, medium: 2, high: 1 })).toBe("high");
    expect(toneForSeverity({ critical: 1, high: 9 })).toBe("critical");
    expect(toneForSeverity({ low: 3 })).toBe("low");
  });

  it("sin severidades es 'none'", () => {
    expect(toneForSeverity({})).toBe("none");
  });
});

describe("sizeForRisk", () => {
  it("la app de mayor risk obtiene MAX_NODE_SIZE", () => {
    expect(sizeForRisk(1000, 1000)).toBe(MAX_NODE_SIZE);
  });

  it("risk 0 obtiene MIN_NODE_SIZE", () => {
    expect(sizeForRisk(0, 1000)).toBe(MIN_NODE_SIZE);
  });

  it("con maxRisk 0 todo cae a MIN_NODE_SIZE", () => {
    expect(sizeForRisk(0, 0)).toBe(MIN_NODE_SIZE);
  });

  it("un risk intermedio queda estrictamente entre MIN y MAX", () => {
    const size = sizeForRisk(100, 1000);
    expect(size).toBeGreaterThan(MIN_NODE_SIZE);
    expect(size).toBeLessThan(MAX_NODE_SIZE);
  });
});

describe("overviewPositions", () => {
  it("coloca cada app en una fila (y = ROW_Y) centrada respecto a la raiz", () => {
    const positions = overviewPositions(3);

    expect(positions).toHaveLength(3);
    expect(positions.every((position) => position.y === ROW_Y)).toBe(true);
    expect(positions[0].x).toBe(-COL_GAP);
    expect(positions[1].x).toBe(0);
    expect(positions[2].x).toBe(COL_GAP);
  });

  it("la suma de las x es 0 para una cantidad simetrica de apps", () => {
    const sum = overviewPositions(4).reduce((total, position) => total + position.x, 0);
    expect(sum).toBe(0);
  });

  it("sin apps devuelve una lista vacia", () => {
    expect(overviewPositions(0)).toEqual([]);
  });
});

describe("gridPositions", () => {
  it("acomoda en filas centradas con el numero de columnas dado", () => {
    const positions = gridPositions(5, 2);

    expect(positions).toHaveLength(5);
    // fila 0: cols 0 y 1 -> x centrado, y = GRID_TOP_Y
    expect(positions[0]).toEqual({ x: -GRID_CELL_X / 2, y: GRID_TOP_Y });
    expect(positions[1]).toEqual({ x: GRID_CELL_X / 2, y: GRID_TOP_Y });
    // fila 1
    expect(positions[2]).toEqual({ x: -GRID_CELL_X / 2, y: GRID_TOP_Y + GRID_CELL_Y });
  });

  it("sin elementos devuelve lista vacia", () => {
    expect(gridPositions(0, 4)).toEqual([]);
  });

  it("con menos elementos que columnas, la unica fila queda centrada (suma x = 0)", () => {
    const sum = gridPositions(4, 6).reduce((total, position) => total + position.x, 0);
    expect(sum).toBe(0);
  });
});
