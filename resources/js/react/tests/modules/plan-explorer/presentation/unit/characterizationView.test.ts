import { beforeEach, describe, expect, it } from "vitest";

import { skeletonLabel, targetKindLabel, targetReasons } from "../../../../../modules/plan-explorer/presentation/constants/characterizationView";
import { useCharacterizationStore } from "../../../../../modules/plan-explorer/presentation/store/characterizationStore";
import type { CharacterizationTarget } from "../../../../../modules/plan-explorer/domain/value-objects/Characterization";

const target = (overrides: Partial<CharacterizationTarget> = {}): CharacterizationTarget => ({
  file: "pages/page.checkout.js",
  kind: "page",
  score: 80,
  risk: 80,
  importers: 0,
  untested: [{ name: "PageCheckout", complexity: 40 }],
  endpoints: [],
  skeletons: [],
  ...overrides,
});

describe("characterizationView", () => {
  it("etiquetas de kind y de esqueleto", () => {
    expect(["page", "component", "php"].map((kind) => targetKindLabel(kind as "page"))).toEqual(["Pagina", "Componente", "PHP"]);
    expect(["rtl", "msw", "playwright", "phpunit"].map((kind) => skeletonLabel(kind as "rtl"))).toEqual(["Test RTL", "Handlers MSW", "Playwright", "PHPUnit"]);
  });

  it("razones: riesgo, uso, sin test y endpoints", () => {
    expect(targetReasons(target())).toEqual(["riesgo 80", "1 sin test: PageCheckout"]);
    expect(
      targetReasons(
        target({
          importers: 150,
          untested: ["A", "B", "C", "D", "E"].map((name) => ({ name, complexity: 1 })),
          endpoints: ["X"],
        }),
      ),
    ).toEqual(["riesgo 80", "importado por 150", "5 sin test: A, B, C (+2)", "1 endpoint"]);
    expect(targetReasons(target({ untested: ["A", "B", "C"].map((name) => ({ name, complexity: 1 })), endpoints: ["X", "Y"] }))).toEqual([
      "riesgo 80",
      "3 sin test: A, B, C",
      "2 endpoints",
    ]);
    expect(targetReasons(target({ untested: [] }))).toEqual(["riesgo 80"]);
  });
});

describe("characterizationStore", () => {
  beforeEach(() => useCharacterizationStore.setState({ open: false }));

  it("abre y cierra; el snapshot de servidor es el estado actual", () => {
    expect(useCharacterizationStore.getInitialState().open).toBe(false);
    useCharacterizationStore.getState().setOpen(true);

    expect(useCharacterizationStore.getState().open).toBe(true);
    expect((useCharacterizationStore as unknown as { getServerState: () => { open: boolean } }).getServerState().open).toBe(true);
  });
});
