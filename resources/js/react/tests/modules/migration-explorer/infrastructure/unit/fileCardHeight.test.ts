import { describe, expect, it } from "vitest";

import { fileCardHeight } from "../../../../../modules/migration-explorer/infrastructure/react-flow/fileCardHeight";

describe("fileCardHeight", () => {
  it("sin nota o con nota vacia mide la base", () => {
    expect(fileCardHeight()).toBe(60);
    expect(fileCardHeight("")).toBe(60);
  });

  it("suma una linea de 13px cada 34 caracteres de nota", () => {
    expect(fileCardHeight("x".repeat(1))).toBe(78);
    expect(fileCardHeight("x".repeat(34))).toBe(78);
    expect(fileCardHeight("x".repeat(35))).toBe(91);
    expect(fileCardHeight("x".repeat(70))).toBe(104);
  });
});
