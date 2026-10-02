import { describe, expect, it } from "vitest";

import { jsTestingAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsTestingAnalyzer.js";
import { jsComponentClass, jsFile, jsFunction, jsMethod } from "../../support/jsStructures.js";

const imports = (...sources: string[]) => sources.map((source) => ({ source, names: [], line: 1 }));

describe("jsTestingAnalyzer", () => {
  it("untested-component medium para un componente simple sin test", () => {
    const file = jsFile("/src/card.js", { classes: [jsComponentClass({ name: "Card", startLine: 4 })] });

    expect(jsTestingAnalyzer([file])).toEqual([
      {
        category: "testing",
        rule: "untested-component",
        severity: "medium",
        source: "native",
        module: "",
        class: "Card",
        file: "/src/card.js",
        line: 4,
        message: 'El componente "Card" no tiene evidencia de test.',
        details: { name: "Card", cyclomaticComplexity: 1, exportedAs: null },
      },
    ]);
  });

  it("exportedAs: default (por nombre o por local del export default), nombrado o null (XRay X4)", () => {
    const classes = ["checkout", "Cart", "Inner", "default"].map((name) => jsComponentClass({ name }));
    const exportsOf = [
      { name: "default", line: 9, local: "checkout" },
      { name: "Cart", line: 9 },
      { name: "Other", line: 9 },
    ];
    const findings = jsTestingAnalyzer([jsFile("/src/page.checkout.js", { classes, exports: exportsOf })]);

    expect(findings.map((finding) => [finding.class, finding.details.exportedAs])).toEqual([
      ["checkout", "default"],
      ["Cart", "Cart"],
      ["Inner", null],
      ["default", "default"],
    ]);
    const anonymous = jsTestingAnalyzer([jsFile("/src/anon.js", { classes: [jsComponentClass({ name: "default" })] })]);
    expect(anonymous[0].details.exportedAs).toBe("default");
  });

  it("high cuando la complejidad del componente supera 10; medium en 10", () => {
    const complex = jsComponentClass({ name: "Checkout", methods: [jsMethod({ name: "render", decisionPointsCount: 10 })] });
    const borderline = jsComponentClass({ name: "Form", methods: [jsMethod({ name: "render", decisionPointsCount: 9 })] });

    const findings = jsTestingAnalyzer([jsFile("/src/a.js", { classes: [complex, borderline] })]);

    expect(findings.map((finding) => [finding.class, finding.severity, finding.details.cyclomaticComplexity])).toEqual([
      ["Checkout", "high", 11],
      ["Form", "medium", 10],
    ]);
  });

  it("un componente importado desde un test no es finding", () => {
    const files = [
      jsFile("/src/card.js", { classes: [jsComponentClass({ name: "Card" })] }),
      jsFile("/src/__tests__/card.js", { imports: imports("../card") }),
    ];

    expect(jsTestingAnalyzer(files)).toEqual([]);
  });

  it.each(["/src/card.test.js", "/src/card.spec.tsx", "/src/card.test.ts", "/src/card.spec.jsx", "/src/card.test.helpers.js"])(
    "%s es un archivo de test (sus imports cuentan, sus componentes no)",
    (testFile) => {
      const files = [
        jsFile("/src/card.js", { classes: [jsComponentClass({ name: "Card" })] }),
        jsFile(testFile, { imports: imports("./card"), functions: [jsFunction({ name: "Harness", containsJsx: true })] }),
      ];

      expect(jsTestingAnalyzer(files)).toEqual([]);
    },
  );

  it("un archivo que no es test no cuenta como evidencia aunque importe el componente", () => {
    const files = [
      jsFile("/src/card.js", { classes: [jsComponentClass({ name: "Card" })] }),
      jsFile("/src/testing.js", { imports: imports("./card") }),
      jsFile("/src/contest.js", { imports: imports("./card") }),
      jsFile("/src/testspec.js", { imports: imports("./card") }),
      jsFile("/src/__tests__.js", { imports: imports("./card") }),
    ];

    expect(jsTestingAnalyzer(files).map((finding) => finding.class)).toEqual(["Card"]);
  });

  it("un import dinamico desde un test cuenta como evidencia para todo lo que encaja", () => {
    const files = [
      jsFile("/src/cards/a.js", { classes: [jsComponentClass({ name: "A" })] }),
      jsFile("/src/cards/b.js", { classes: [jsComponentClass({ name: "B" })] }),
      jsFile("/src/cards.test.js", { imports: imports("./cards/${}") }),
    ];

    expect(jsTestingAnalyzer(files)).toEqual([]);
  });

  it("los archivos sin componentes no generan findings", () => {
    expect(jsTestingAnalyzer([jsFile("/src/utils.js", { functions: [jsFunction()] })])).toEqual([]);
  });
});
