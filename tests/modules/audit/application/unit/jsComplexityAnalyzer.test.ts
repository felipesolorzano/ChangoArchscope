import { describe, expect, it } from "vitest";

import { jsComplexityAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsComplexityAnalyzer.js";
import { jsClass, jsComponentClass, jsFile, jsFunction, jsMethod } from "../../support/jsStructures.js";

const rules = (findings: { rule: string }[]) => findings.map((finding) => finding.rule);

describe("jsComplexityAnalyzer — metodos y funciones", () => {
  it("long-method al superar 50 lineas (51), no en 50", () => {
    const file = jsFile("/src/a.js", {
      functions: [jsFunction({ name: "big", startLine: 10, endLine: 60 }), jsFunction({ name: "ok", startLine: 1, endLine: 50 })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings).toEqual([
      {
        category: "complexity",
        rule: "long-method",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 10,
        message: "Funcion o metodo con 51 lineas, supera el umbral configurado.",
        details: { lines: 51 },
      },
    ]);
  });

  it("render usa su propio umbral: long-render al superar 150, no long-method", () => {
    const klass = jsClass({
      name: "Tours",
      methods: [
        jsMethod({ name: "render", startLine: 1, endLine: 151 }),
        jsMethod({ name: "load", startLine: 200, endLine: 251 }),
      ],
    });
    const atThreshold = jsClass({ methods: [jsMethod({ name: "render", startLine: 1, endLine: 150 })] });

    const findings = jsComplexityAnalyzer([jsFile("/src/a.js", { classes: [klass, atThreshold] })]);

    expect(findings.map((finding) => [finding.rule, finding.class, finding.line, finding.details])).toEqual([
      ["long-render", "Tours", 1, { lines: 151 }],
      ["long-method", "Tours", 200, { lines: 52 }],
    ]);
    expect(findings[0].message).toBe("render() con 151 lineas, supera el umbral configurado.");
    expect(findings[0].severity).toBe("medium");
  });

  it("una funcion de nivel superior llamada render usa el umbral comun", () => {
    const file = jsFile("/src/a.js", { functions: [jsFunction({ name: "render", startLine: 1, endLine: 60 })] });

    expect(rules(jsComplexityAnalyzer([file]))).toEqual(["long-method"]);
  });

  it("too-many-parameters al superar 5", () => {
    const file = jsFile("/src/a.js", {
      functions: [jsFunction({ parametersCount: 6, startLine: 4 }), jsFunction({ parametersCount: 5 })],
    });

    const [finding, ...rest] = jsComplexityAnalyzer([file]);

    expect(rest).toEqual([]);
    expect(finding).toMatchObject({
      rule: "too-many-parameters",
      severity: "medium",
      line: 4,
      details: { parametersCount: 6 },
      message: "Funcion o metodo con 6 parametros, supera el umbral configurado.",
    });
  });

  it("high-cyclomatic-complexity al superar 10 (10 puntos de decision = 11)", () => {
    const file = jsFile("/src/a.js", {
      classes: [jsClass({ name: "A", methods: [jsMethod({ decisionPointsCount: 10, startLine: 7 }), jsMethod({ decisionPointsCount: 9 })] })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "high-cyclomatic-complexity",
      severity: "high",
      class: "A",
      line: 7,
      details: { cyclomaticComplexity: 11 },
      message: "Complejidad ciclomatica 11, supera el umbral configurado.",
    });
  });
});

describe("jsComplexityAnalyzer — componentes y clases", () => {
  it("large-component para una clase componente de mas de 300 lineas", () => {
    const file = jsFile("/src/a.js", {
      classes: [jsComponentClass({ name: "Checkout", startLine: 5, endLine: 305 }), jsComponentClass({ startLine: 1, endLine: 300 })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings).toEqual([
      expect.objectContaining({
        rule: "large-component",
        severity: "medium",
        class: "Checkout",
        line: 5,
        details: { lines: 301 },
        message: "Componente con 301 lineas, supera el umbral configurado.",
      }),
    ]);
  });

  it("large-component para una funcion componente, con su nombre como class", () => {
    const file = jsFile("/src/a.js", {
      functions: [jsFunction({ name: "Card", containsJsx: true, startLine: 1, endLine: 301 })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings.map((finding) => [finding.rule, finding.class, finding.details])).toEqual([
      ["long-method", null, { lines: 301 }],
      ["large-component", "Card", { lines: 301 }],
    ]);
  });

  it("una funcion componente de 300 lineas, o una funcion larga sin JSX, no es large-component", () => {
    const file = jsFile("/src/a.js", {
      functions: [
        jsFunction({ name: "Card", containsJsx: true, startLine: 1, endLine: 300 }),
        jsFunction({ name: "helper", containsJsx: false, startLine: 1, endLine: 400 }),
      ],
    });

    expect(rules(jsComplexityAnalyzer([file]))).toEqual(["long-method", "long-method"]);
  });

  it("large-class para una clase que no es componente", () => {
    const file = jsFile("/src/a.js", {
      classes: [jsClass({ name: "Utils", extendsName: "I18n", startLine: 2, endLine: 302 }), jsClass({ startLine: 1, endLine: 300 })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings).toEqual([
      expect.objectContaining({
        rule: "large-class",
        severity: "medium",
        class: "Utils",
        line: 2,
        details: { lines: 301 },
        message: "Clase con 301 lineas, supera el umbral configurado.",
      }),
    ]);
  });

  it("large-state al superar 10 claves de estado", () => {
    const file = jsFile("/src/a.js", {
      classes: [jsComponentClass({ name: "Form", startLine: 3, stateKeysCount: 11 }), jsComponentClass({ stateKeysCount: 10 })],
    });

    const findings = jsComplexityAnalyzer([file]);

    expect(findings).toEqual([
      expect.objectContaining({
        rule: "large-state",
        severity: "medium",
        class: "Form",
        line: 3,
        details: { stateKeys: 11 },
        message: "Componente con 11 claves de estado, supera el umbral configurado.",
      }),
    ]);
  });

  it("acepta umbrales propios", () => {
    const file = jsFile("/src/a.js", { functions: [jsFunction({ startLine: 1, endLine: 5 })] });

    const findings = jsComplexityAnalyzer([file], {
      methodLines: 4,
      renderLines: 150,
      parameters: 5,
      cyclomaticComplexity: 10,
      componentLines: 300,
      classLines: 300,
      stateKeys: 10,
    });

    expect(rules(findings)).toEqual(["long-method"]);
  });

  it("un archivo sin clases ni funciones no genera findings", () => {
    expect(jsComplexityAnalyzer([jsFile("/src/a.js")])).toEqual([]);
  });
});
