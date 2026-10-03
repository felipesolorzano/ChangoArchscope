import { describe, expect, it } from "vitest";

import { planPhases } from "../../../../../app/modules/plan/domain/services/planPhases.js";
import type { PlanSignals } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";

// Todo en cero, con datos completos: todas las fases pasan.
function clean(over: Partial<PlanSignals> = {}): PlanSignals {
  return {
    findingCounts: {},
    categoryCounts: {},
    duplicatePairs: 0,
    skippedFiles: 0,
    dependencies: { counts: {}, items: {} },
    protectionLevel: "low",
    topRiskUntested: 0,
    healthyPercent: 80,
    ...over,
  };
}

const gate = (key: string, label: string, value: number | null, extra: { target?: number; comparator?: "max" | "min"; format?: string; status?: string } = {}) => ({
  key,
  label,
  value,
  target: extra.target ?? 0,
  comparator: extra.comparator ?? "max",
  format: extra.format ?? "count",
  status: extra.status ?? "passed",
});

describe("planPhases (XRay X6)", () => {
  it("react: las 11 fases con sus gates; todo en cero pasa y no hay fase actual", () => {
    expect(planPhases(clean(), "react", [])).toEqual([
      { number: 0, key: "baseline", title: "Linea base", goal: "Todo el codigo propio se analiza", status: "passed", current: false, tasks: [], gates: [gate("parse-errors", "Archivos que no parsean", 0)] },
      {
        number: 1,
        key: "security",
        title: "Seguridad",
        goal: "Sin inyecciones, sinks XSS, paquetes vulnerables ni runtime sin soporte",
        status: "passed",
        current: false,
        tasks: [],
        gates: [
          gate("injections", "Inyecciones (SQL, eval, Function)", 0),
          gate("xss-sinks", "Sinks XSS", 0),
          gate("vulnerable-packages", "Paquetes vulnerables", 0),
          gate("unsupported-runtime", "Runtime sin soporte", 0),
        ],
      },
      {
        number: 2,
        key: "cleanup",
        title: "Limpieza",
        goal: "Sin copias, archivos muertos ni migraciones a medias",
        status: "passed",
        current: false,
        tasks: [],
        gates: [
          gate("manual-copies", "Copias manuales", 0),
          gate("unused-files", "Archivos sin uso", 0),
          gate("duplicate-migrations", "Migraciones a medias (_new)", 0),
          gate("unused-exports", "Exports sin uso", 0),
          gate("unused-packages", "Paquetes sin uso", 0),
        ],
      },
      {
        number: 3,
        key: "safety-net",
        title: "Red de seguridad",
        goal: "Lo mas riesgoso tiene tests antes de tocarlo",
        status: "passed",
        current: false,
        tasks: [],
        gates: [
          gate("protection-level", "Nivel de proteccion", 1, { target: 1, comparator: "min", format: "level" }),
          gate("top-risk-untested", "Sin tests entre los 10 mas riesgosos", 0),
        ],
      },
      { number: 4, key: "architecture", title: "Arquitectura", goal: "Sin ciclos de imports", status: "passed", current: false, tasks: [], gates: [gate("import-cycles", "Ciclos de imports", 0)] },
      { number: 5, key: "removed-apis", title: "APIs eliminadas", goal: "Nada que rompa al subir de version", status: "passed", current: false, tasks: [], gates: [gate("removed-apis", "Usos de APIs eliminadas", 0)] },
      {
        number: 6,
        key: "deprecated-apis",
        title: "APIs y librerias deprecadas",
        goal: "Sin APIs deprecadas ni paquetes abandonados",
        status: "passed",
        current: false,
        tasks: [],
        gates: [gate("deprecated-apis", "Usos de APIs deprecadas", 0), gate("abandoned-packages", "Paquetes abandonados", 0)],
      },
      {
        number: 7,
        key: "decoupling",
        title: "Desacople",
        goal: "Sin jQuery ni herencia de clases base propias",
        status: "passed",
        current: false,
        tasks: [],
        gates: [gate("jquery", "jQuery / DOM directo", 0), gate("base-classes", "Herencia de clases base", 0)],
      },
      { number: 8, key: "data-http", title: "Datos y HTTP", goal: "Acceso a datos y HTTP en su capa", status: "passed", current: false, tasks: [], gates: [gate("http-layer", "HTTP en componentes / duplicado / URL fija", 0)] },
      {
        number: 9,
        key: "complexity",
        title: "Complejidad",
        goal: "Sin clases ni componentes gigantes",
        status: "passed",
        current: false,
        tasks: [],
        gates: [gate("god-classes", "Clases gigantes", 0), gate("large-components", "Componentes grandes", 0)],
      },
      {
        number: 10,
        key: "upgrade",
        title: "Actualizacion y validacion",
        goal: "Versiones al dia y la mayoria del codigo sano",
        status: "passed",
        current: false,
        tasks: [],
        gates: [gate("major-updates", "Saltos de version mayor pendientes", 0), gate("healthy-files", "Archivos sanos", 80, { target: 80, comparator: "min", format: "percent" })],
      },
    ]);
  });

  it("laravel: gates por stack; desacople no aplica", () => {
    const phases = planPhases(clean(), "laravel", []);

    expect(phases.map((phase) => [phase.key, phase.status, phase.gates.map((item) => item.key)])).toEqual([
      ["baseline", "passed", ["parse-errors"]],
      ["security", "passed", ["injections", "vulnerable-packages", "unsupported-runtime"]],
      ["cleanup", "passed", ["manual-copies", "unused-files", "duplicate-migrations", "unused-packages"]],
      ["safety-net", "passed", ["protection-level", "top-risk-untested"]],
      ["architecture", "passed", ["import-cycles"]],
      ["removed-apis", "passed", ["removed-apis"]],
      ["deprecated-apis", "passed", ["deprecated-apis", "abandoned-packages"]],
      ["decoupling", "not-applicable", []],
      ["data-http", "passed", ["n-plus-one", "data-layer"]],
      ["complexity", "passed", ["god-classes"]],
      ["upgrade", "passed", ["major-updates", "healthy-files"]],
    ]);
    expect(phases.find((phase) => phase.key === "data-http")?.gates.map((item) => item.label)).toEqual(["Consultas N+1", "SQL fuera de infraestructura / duplicado"]);
  });

  it("valor de cada gate desde sus reglas, señales y dependencias", () => {
    const rules = [
      "sql-concatenation", "eval-usage", "new-function", "dangerously-set-inner-html", "inner-html-assignment", "manual-copy-file", "possibly-unused-file",
      "unused-export", "import-cycle", "unsafe-lifecycle", "legacy-react-dom-api", "string-ref", "removed-php-function", "with-router", "deprecated-library",
      "deprecated-php-function", "jquery-usage", "direct-dom-access", "base-class-inheritance", "n-plus-one-query", "raw-sql-outside-infrastructure",
      "duplicate-sql", "http-in-component", "duplicate-endpoint", "hardcoded-api-url", "large-class", "large-component", "long-render", "large-state",
    ];
    // Cada regla con un valor distinto (potencias de 2 no hacen falta: sumas chicas y legibles).
    const findingCounts = Object.fromEntries(rules.map((rule, index) => [rule, { medium: index + 1 }]));
    const dependencies = {
      counts: { "fix-vulnerable-packages": 101, "update-unsupported-runtime": 102, "remove-unused-packages": 103, "replace-abandoned-packages": 104, "upgrade-major-versions": 105 },
      items: {},
    };
    const values = (stack: "laravel" | "react") =>
      Object.fromEntries(
        planPhases(clean({ findingCounts, dependencies, skippedFiles: 7, duplicatePairs: 8, protectionLevel: "none", topRiskUntested: 9, healthyPercent: 79 }), stack, [])
          .flatMap((phase) => phase.gates)
          .map((item) => [item.key, [item.value, item.status]]),
      );

    expect(values("react")).toEqual({
      "parse-errors": [7, "failed"],
      injections: [1 + 2 + 3, "failed"],
      "xss-sinks": [4 + 5, "failed"],
      "vulnerable-packages": [101, "failed"],
      "unsupported-runtime": [102, "failed"],
      "manual-copies": [6, "failed"],
      "unused-files": [7, "failed"],
      "duplicate-migrations": [8, "failed"],
      "unused-exports": [8, "failed"],
      "unused-packages": [103, "failed"],
      "protection-level": [0, "failed"],
      "top-risk-untested": [9, "failed"],
      "import-cycles": [9, "failed"],
      "removed-apis": [10 + 11 + 12 + 13, "failed"],
      "deprecated-apis": [14 + 15 + 16, "failed"],
      "abandoned-packages": [104, "failed"],
      jquery: [17 + 18, "failed"],
      "base-classes": [19, "failed"],
      "http-layer": [23 + 24 + 25, "failed"],
      "god-classes": [26, "failed"],
      "large-components": [27 + 28 + 29, "failed"],
      "major-updates": [105, "failed"],
      "healthy-files": [79, "failed"],
    });
    expect(values("laravel")).toMatchObject({ "n-plus-one": [20, "failed"], "data-layer": [21 + 22, "failed"] });
  });

  it("niveles de proteccion: none 0, low 1, medium 2, high 3", () => {
    const level = (protectionLevel: PlanSignals["protectionLevel"]) => planPhases(clean({ protectionLevel }), "react", [])[3].gates[0].value;

    expect(["none", "low", "medium", "high"].map((value) => level(value as "low"))).toEqual([0, 1, 2, 3]);
  });

  it("sin datos: gates unknown; la fase queda unknown si nada fallo y es la actual", () => {
    const phases = planPhases(clean({ dependencies: undefined, protectionLevel: null, topRiskUntested: undefined, healthyPercent: undefined }), "react", []);

    expect(phases[1].gates.find((item) => item.key === "vulnerable-packages")).toMatchObject({ value: null, status: "unknown" });
    expect(phases.map((phase) => [phase.key, phase.status, phase.current])).toEqual([
      ["baseline", "passed", false],
      ["security", "unknown", true],
      ["cleanup", "unknown", false],
      ["safety-net", "unknown", false],
      ["architecture", "passed", false],
      ["removed-apis", "passed", false],
      ["deprecated-apis", "unknown", false],
      ["decoupling", "passed", false],
      ["data-http", "passed", false],
      ["complexity", "passed", false],
      ["upgrade", "unknown", false],
    ]);
  });

  it("failed gana a unknown en la fase; la actual es la primera no cumplida", () => {
    const phases = planPhases(clean({ dependencies: undefined, findingCounts: { "eval-usage": { high: 1 } }, skippedFiles: 1 }), "react", []);

    expect(phases[1].status).toBe("failed");
    expect(phases.filter((phase) => phase.current).map((phase) => phase.key)).toEqual(["baseline"]);
  });

  it("bordes: max pasa con value = target y min falla por debajo", () => {
    expect(planPhases(clean({ healthyPercent: 81 }), "react", [])[10].status).toBe("passed");
    expect(planPhases(clean({ healthyPercent: 79 }), "react", [])[10].status).toBe("failed");
    expect(planPhases(clean({ skippedFiles: 1 }), "react", [])[0].status).toBe("failed");
  });

  it("tasks: las de la fase que estan en el plan, en el orden de la fase", () => {
    const phases = planPhases(clean(), "react", ["validate-risk-reduction", "close-xss-sinks", "close-sql-injections", "fix-vulnerable-packages", "unknown"]);

    expect(phases[1].tasks).toEqual(["close-sql-injections", "close-xss-sinks", "fix-vulnerable-packages"]);
    expect(phases[10].tasks).toEqual(["validate-risk-reduction"]);
    expect(planPhases(clean(), "react", ["exclude-third-party", "remove-manual-copies", "remove-unused-files", "resolve-duplicate-migrations", "remove-unused-exports", "remove-unused-packages", "close-code-injection", "update-unsupported-runtime", "add-characterization-tests", "add-component-tests", "break-import-cycles", "apply-legacy-codemods", "migrate-deprecated-apis", "replace-abandoned-packages", "remove-jquery", "replace-base-class-inheritance", "reduce-n-plus-one", "extract-data-layer", "isolate-http-layer", "break-god-classes", "split-large-components", "apply-safe-updates", "upgrade-major-versions"]).map((phase) => phase.tasks)).toEqual([
      ["exclude-third-party"],
      ["close-code-injection", "update-unsupported-runtime"],
      ["remove-manual-copies", "remove-unused-files", "resolve-duplicate-migrations", "remove-unused-exports", "remove-unused-packages"],
      ["add-characterization-tests", "add-component-tests"],
      ["break-import-cycles"],
      ["apply-legacy-codemods"],
      ["migrate-deprecated-apis", "replace-abandoned-packages"],
      ["remove-jquery", "replace-base-class-inheritance"],
      ["reduce-n-plus-one", "extract-data-layer", "isolate-http-layer"],
      ["break-god-classes", "split-large-components"],
      ["apply-safe-updates", "upgrade-major-versions"],
    ]);
  });
});
