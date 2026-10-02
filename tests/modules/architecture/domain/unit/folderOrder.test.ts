import { describe, expect, it } from "vitest";

import { folderOrderViolation, folderRank } from "../../../../../app/modules/architecture/domain/services/folderOrder.js";

const order = ["routes", "pages", ["components", "stripes"], "globals"];

describe("folderRank", () => {
  it("devuelve el indice del nivel, incluyendo carpetas agrupadas", () => {
    expect(folderRank(order, "routes")).toBe(0);
    expect(folderRank(order, "pages")).toBe(1);
    expect(folderRank(order, "components")).toBe(2);
    expect(folderRank(order, "stripes")).toBe(2);
    expect(folderRank(order, "globals")).toBe(3);
  });

  it("null para carpetas fuera del orden", () => {
    expect(folderRank(order, "configs")).toBeNull();
    expect(folderRank([], "pages")).toBeNull();
  });
});

describe("folderOrderViolation", () => {
  it("arriba -> abajo esta permitido", () => {
    expect(folderOrderViolation(order, "pages", "components")).toBe(false);
    expect(folderOrderViolation(order, "routes", "globals")).toBe(false);
  });

  it("abajo -> arriba es violacion", () => {
    expect(folderOrderViolation(order, "components", "pages")).toBe(true);
    expect(folderOrderViolation(order, "globals", "routes")).toBe(true);
  });

  it("mismo nivel o misma carpeta esta permitido", () => {
    expect(folderOrderViolation(order, "components", "stripes")).toBe(false);
    expect(folderOrderViolation(order, "stripes", "components")).toBe(false);
    expect(folderOrderViolation(order, "pages", "pages")).toBe(false);
  });

  it("si alguna carpeta esta fuera del orden no hay violacion", () => {
    expect(folderOrderViolation(order, "configs", "routes")).toBe(false);
    expect(folderOrderViolation(order, "globals", "configs")).toBe(false);
  });
});
