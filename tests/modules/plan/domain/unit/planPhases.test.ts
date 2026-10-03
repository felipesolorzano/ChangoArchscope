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
  it("react: las 11 fases en el orden del flujo; todo en cero pasa y no hay fase actual", () => {
    const phase = (number: number, key: string, title: string, goal: string, gates: unknown[]) => ({ number, key, title, goal, status: "passed", current: false, tasks: [], gates });

    expect(planPhases(clean(), "react", [])).toEqual([
      phase(-1, "hotfix", "Hotfix critico", "Sin vulnerabilidades criticas en paquetes", [gate("critical-packages", "Paquetes con vulnerabilidades criticas", 0)]),
      phase(0, "baseline", "Linea base", "Todo el codigo propio se analiza", [gate("parse-errors", "Archivos que no parsean", 0)]),
      phase(1, "cleanup", "Limpieza", "Sin copias, archivos muertos ni migraciones a medias", [
        gate("manual-copies", "Copias manuales", 0),
        gate("unused-files", "Archivos sin uso", 0),
        gate("duplicate-migrations", "Migraciones a medias (_new)", 0),
        gate("unused-exports", "Exports sin uso", 0),
        gate("unused-packages", "Paquetes sin uso", 0),
      ]),
      phase(2, "safety-net", "Red de seguridad", "Lo mas riesgoso tiene tests antes de tocarlo", [
        gate("protection-level", "Nivel de proteccion", 1, { target: 1, comparator: "min", format: "level" }),
        gate("top-risk-untested", "Sin tests entre los 10 mas riesgosos", 0),
      ]),
      phase(3, "security", "Seguridad del codigo", "Sin inyecciones ni sinks XSS, con los tests como red", [
        gate("injections", "Inyecciones (SQL, eval, Function)", 0),
        gate("xss-sinks", "Sinks XSS", 0),
      ]),
      phase(4, "architecture", "Arquitectura", "Sin ciclos de imports", [gate("import-cycles", "Ciclos de imports", 0)]),
      phase(5, "pre-upgrade-apis", "APIs legacy (antes de actualizar)", "Migrar lo que ya tiene reemplazo en la version actual", [
        gate("removed-apis", "APIs eliminadas con reemplazo actual", 0),
        gate("deprecated-apis", "APIs y librerias deprecadas", 0),
      ]),
      phase(6, "layers", "Desacople y capas", "jQuery, herencia, HTTP y datos en su capa", [
        gate("jquery", "jQuery / DOM directo", 0),
        gate("base-classes", "Herencia de clases base", 0),
        gate("http-layer", "HTTP en componentes / duplicado / URL fija", 0),
      ]),
      phase(7, "safe-updates", "Paquetes vulnerables y patch/minor", "Actualizaciones que no rompen, con los tests en verde", [
        gate("vulnerable-packages", "Paquetes vulnerables", 0),
        gate("safe-updates", "Actualizaciones patch/minor pendientes", 0),
      ]),
      phase(8, "major-upgrades", "Runtime y versiones major", "Un salto a la vez, con tests verdes antes y despues", [
        gate("unsupported-runtime", "Runtime sin soporte", 0),
        gate("major-updates", "Saltos de version mayor pendientes", 0),
        gate("abandoned-packages", "Paquetes abandonados", 0),
      ]),
      phase(9, "post-upgrade-apis", "APIs de la version nueva", "Adoptar lo que exige la version nueva", [gate("post-upgrade-apis", "APIs a migrar despues de actualizar", 0)]),
      phase(10, "validation", "Complejidad y validacion", "Sin piezas gigantes y la mayoria del codigo sano", [
        gate("god-classes", "Clases gigantes", 0),
        gate("large-components", "Componentes grandes", 0),
        gate("healthy-files", "Archivos sanos", 80, { target: 80, comparator: "min", format: "percent" }),
      ]),
    ]);
  });

  it("laravel: gates por stack; las APIs de la version nueva no aplican", () => {
    const phases = planPhases(clean(), "laravel", []);

    expect(phases.map((phase) => [phase.key, phase.status, phase.gates.map((item) => item.key)])).toEqual([
      ["hotfix", "passed", ["critical-packages"]],
      ["baseline", "passed", ["parse-errors"]],
      ["cleanup", "passed", ["manual-copies", "unused-files", "duplicate-migrations", "unused-packages"]],
      ["safety-net", "passed", ["protection-level", "top-risk-untested"]],
      ["security", "passed", ["injections"]],
      ["architecture", "passed", ["import-cycles"]],
      ["pre-upgrade-apis", "passed", ["removed-apis", "deprecated-apis"]],
      ["layers", "passed", ["n-plus-one", "data-layer"]],
      ["safe-updates", "passed", ["vulnerable-packages", "safe-updates"]],
      ["major-upgrades", "passed", ["unsupported-runtime", "major-updates", "abandoned-packages"]],
      ["post-upgrade-apis", "not-applicable", []],
      ["validation", "passed", ["god-classes", "healthy-files"]],
    ]);
    expect(phases.find((phase) => phase.key === "layers")?.gates.map((item) => item.label)).toEqual(["Consultas N+1", "SQL fuera de infraestructura / duplicado"]);
  });

  it("valor de cada gate desde sus reglas, señales y dependencias", () => {
    const rules = [
      "sql-concatenation", "eval-usage", "new-function", "dangerously-set-inner-html", "inner-html-assignment", "manual-copy-file", "possibly-unused-file",
      "unused-export", "import-cycle", "unsafe-lifecycle", "find-dom-node", "string-ref", "removed-php-function", "with-router", "deprecated-library",
      "deprecated-php-function", "jquery-usage", "direct-dom-access", "base-class-inheritance", "n-plus-one-query", "raw-sql-outside-infrastructure",
      "duplicate-sql", "http-in-component", "duplicate-endpoint", "hardcoded-api-url", "large-class", "large-component", "long-render", "large-state",
      "legacy-react-dom-api",
    ];
    // Cada regla con un valor distinto: la posicion + 1.
    const findingCounts = Object.fromEntries(rules.map((rule, index) => [rule, { medium: index + 1 }]));
    const dependencies = {
      counts: { "hotfix-critical-packages": 107, "fix-vulnerable-packages": 101, "update-unsupported-runtime": 102, "remove-unused-packages": 103, "replace-abandoned-packages": 104, "upgrade-major-versions": 105, "apply-safe-updates": 106 },
      items: {},
    };
    const values = (stack: "laravel" | "react") =>
      Object.fromEntries(
        planPhases(clean({ findingCounts, dependencies, skippedFiles: 7, duplicatePairs: 8, protectionLevel: "none", topRiskUntested: 9, healthyPercent: 79 }), stack, [])
          .flatMap((phase) => phase.gates)
          .map((item) => [item.key, [item.value, item.status]]),
      );

    expect(values("react")).toEqual({
      "critical-packages": [107, "failed"],
      "parse-errors": [7, "failed"],
      "manual-copies": [6, "failed"],
      "unused-files": [7, "failed"],
      "duplicate-migrations": [8, "failed"],
      "unused-exports": [8, "failed"],
      "unused-packages": [103, "failed"],
      "protection-level": [0, "failed"],
      "top-risk-untested": [9, "failed"],
      injections: [1 + 2 + 3, "failed"],
      "xss-sinks": [4 + 5, "failed"],
      "import-cycles": [9, "failed"],
      "removed-apis": [10 + 11 + 12 + 13, "failed"],
      "deprecated-apis": [14 + 15 + 16, "failed"],
      jquery: [17 + 18, "failed"],
      "base-classes": [19, "failed"],
      "http-layer": [23 + 24 + 25, "failed"],
      "vulnerable-packages": [101, "failed"],
      "safe-updates": [106, "failed"],
      "unsupported-runtime": [102, "failed"],
      "major-updates": [105, "failed"],
      "abandoned-packages": [104, "failed"],
      "post-upgrade-apis": [30, "failed"],
      "god-classes": [26, "failed"],
      "large-components": [27 + 28 + 29, "failed"],
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

    expect(phases[8].gates.find((item) => item.key === "vulnerable-packages")).toMatchObject({ value: null, status: "unknown" });
    expect(phases.map((phase) => [phase.key, phase.status, phase.current])).toEqual([
      // El hotfix es un carril paralelo: sin datos queda unknown pero nunca es la fase actual.
      ["hotfix", "unknown", false],
      ["baseline", "passed", false],
      ["cleanup", "unknown", true],
      ["safety-net", "unknown", false],
      ["security", "passed", false],
      ["architecture", "passed", false],
      ["pre-upgrade-apis", "passed", false],
      ["layers", "passed", false],
      ["safe-updates", "unknown", false],
      ["major-upgrades", "unknown", false],
      ["post-upgrade-apis", "passed", false],
      ["validation", "unknown", false],
    ]);
  });

  it("el hotfix con criticas falla pero la fase actual sigue siendo la del flujo (XRay X6)", () => {
    const phases = planPhases(clean({ dependencies: { counts: { "hotfix-critical-packages": 2 }, items: {} }, skippedFiles: 1 }), "react", ["hotfix-critical-packages"]);

    expect(phases[0]).toMatchObject({ key: "hotfix", status: "failed", current: false, tasks: ["hotfix-critical-packages"] });
    expect(phases.filter((phase) => phase.current).map((phase) => phase.key)).toEqual(["baseline"]);
  });

  it("failed gana a unknown en la fase; la actual es la primera no cumplida", () => {
    const phases = planPhases(clean({ dependencies: undefined, findingCounts: { "manual-copy-file": { low: 1 } }, skippedFiles: 1 }), "react", []);

    expect(phases[2].status).toBe("failed");
    expect(phases.filter((phase) => phase.current).map((phase) => phase.key)).toEqual(["baseline"]);
  });

  it("bordes: max pasa con value = target y min falla por debajo", () => {
    expect(planPhases(clean({ healthyPercent: 81 }), "react", [])[11].status).toBe("passed");
    expect(planPhases(clean({ healthyPercent: 79 }), "react", [])[11].status).toBe("failed");
    expect(planPhases(clean({ skippedFiles: 1 }), "react", [])[1].status).toBe("failed");
  });

  it("tasks: los pasos de major van en la fase 8, en el orden del plan (XRay X6)", () => {
    const phases = planPhases(clean(), "react", ["upgrade-major:react", "update-unsupported-runtime", "upgrade-major:otros", "replace-abandoned-packages"]);

    expect(phases[9].tasks).toEqual(["update-unsupported-runtime", "upgrade-major:react", "upgrade-major:otros", "replace-abandoned-packages"]);
  });

  it("tasks: las de la fase que estan en el plan, en el orden de la fase", () => {
    const phases = planPhases(clean(), "react", ["validate-risk-reduction", "close-xss-sinks", "close-sql-injections", "unknown"]);

    expect(phases[4].tasks).toEqual(["close-sql-injections", "close-xss-sinks"]);
    expect(phases[11].tasks).toEqual(["validate-risk-reduction"]);
    expect(planPhases(clean(), "react", ["exclude-third-party", "remove-manual-copies", "remove-unused-files", "resolve-duplicate-migrations", "remove-unused-exports", "remove-unused-packages", "close-code-injection", "update-unsupported-runtime", "add-characterization-tests", "add-component-tests", "break-import-cycles", "apply-legacy-codemods", "migrate-deprecated-apis", "replace-abandoned-packages", "remove-jquery", "replace-base-class-inheritance", "reduce-n-plus-one", "extract-data-layer", "isolate-http-layer", "break-god-classes", "split-large-components", "apply-safe-updates", "upgrade-major-versions", "fix-vulnerable-packages", "apply-post-upgrade-codemods"]).map((phase) => phase.tasks)).toEqual([
      [],
      ["exclude-third-party"],
      ["remove-manual-copies", "remove-unused-files", "resolve-duplicate-migrations", "remove-unused-exports", "remove-unused-packages"],
      ["add-characterization-tests", "add-component-tests"],
      ["close-code-injection"],
      ["break-import-cycles"],
      ["apply-legacy-codemods", "migrate-deprecated-apis"],
      ["isolate-http-layer", "remove-jquery", "replace-base-class-inheritance", "reduce-n-plus-one", "extract-data-layer"],
      ["fix-vulnerable-packages", "apply-safe-updates"],
      ["update-unsupported-runtime", "upgrade-major-versions", "replace-abandoned-packages"],
      ["apply-post-upgrade-codemods"],
      ["break-god-classes", "split-large-components"],
    ]);
  });
});
