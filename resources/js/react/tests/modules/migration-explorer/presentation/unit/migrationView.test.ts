import { describe, expect, it } from "vitest";

import { layerColor, layerLabel } from "../../../../../modules/migration-explorer/presentation/constants/migrationView";

describe("layerColor", () => {
  it("un color por cada capa, distintos", () => {
    const colors = (["domain", "application", "infrastructure", "presentation"] as const).map(layerColor);
    expect(new Set(colors).size).toBe(4);
    colors.forEach((color) => expect(color).toMatch(/^#|rgb/));
  });

  it("capa desconocida cae a un color por defecto", () => {
    expect(layerColor("???" as never)).toMatch(/^#|rgb/);
  });
});

describe("layerLabel", () => {
  it("etiqueta legible por capa", () => {
    expect(layerLabel("domain")).toBe("Domain");
    expect(layerLabel("infrastructure")).toBe("Infrastructure");
  });
});
