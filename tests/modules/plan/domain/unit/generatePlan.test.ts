import { describe, expect, it } from "vitest";

import type { PlanSignals } from "../../../../../app/modules/plan/domain/value-objects/Plan.js";
import { generatePlan } from "../../../../../app/modules/plan/domain/services/generatePlan.js";

function signals(over: Partial<PlanSignals> = {}): PlanSignals {
  return { findingCounts: {}, categoryCounts: {}, duplicatePairs: 0, skippedFiles: 0, ...over };
}

// Conteos por regla, todos con la misma severidad (por defecto high).
function counts(byRule: Record<string, number>, severity = "high"): PlanSignals["findingCounts"] {
  return Object.fromEntries(Object.entries(byRule).map(([rule, count]) => [rule, { [severity]: count }]));
}

describe("generatePlan", () => {
  it("deriva tareas solo para las senales presentes (metric > 0)", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "sql-concatenation": 104, "untested-complex-method": 300 }),
        skippedFiles: 6,
      }),
    );

    expect(plan.map((task) => task.key).sort()).toEqual([
      "add-characterization-tests",
      "close-sql-injections",
      "exclude-third-party",
      "validate-risk-reduction",
    ]);
  });

  it("calcula la metrica de cada tarea desde las senales", () => {
    const plan = generatePlan(
      signals({ findingCounts: counts({ "raw-sql-outside-infrastructure": 1000, "duplicate-sql": 500, "n-plus-one-query": 200 }) }),
    );

    const dataLayer = plan.find((task) => task.key === "extract-data-layer");
    const nPlusOne = plan.find((task) => task.key === "reduce-n-plus-one");

    expect(dataLayer?.metric).toBe(1500);
    expect(nPlusOne?.metric).toBe(200);
  });

  it("poda dependsOn a tareas incluidas; validate-risk-reduction depende de todas las demas", () => {
    const plan = generatePlan(signals({ findingCounts: counts({ "sql-concatenation": 10 }) }));

    const validate = plan.find((task) => task.key === "validate-risk-reduction");
    const sql = plan.find((task) => task.key === "close-sql-injections");

    expect(sql?.dependsOn).toEqual([]); // su dep (tests) no esta incluida -> podada
    expect(validate?.dependsOn).toEqual(["close-sql-injections"]);
  });

  it("reduce-n-plus-one depende de los tests cuando ambos estan presentes", () => {
    const plan = generatePlan(
      signals({ findingCounts: counts({ "n-plus-one-query": 50, "untested-complex-method": 5 }) }),
    );

    const nPlusOne = plan.find((task) => task.key === "reduce-n-plus-one");
    expect(nPlusOne?.dependsOn).toContain("add-characterization-tests");
  });

  it("senales vacias producen un plan vacio (ni siquiera validate)", () => {
    expect(generatePlan(signals())).toEqual([]);
  });

  it("con todas las senales genera el roadmap completo con key/title/category/metric/dependsOn", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({
          "sql-concatenation": 10,
          "untested-complex-method": 20,
          "n-plus-one-query": 30,
          "raw-sql-outside-infrastructure": 40,
          "duplicate-sql": 5,
          "large-class": 7,
        }),
        duplicatePairs: 3,
        skippedFiles: 4,
      }),
    );

    expect(plan.map((task) => ({ key: task.key, title: task.title, category: task.category, metric: task.metric, dependsOn: task.dependsOn }))).toEqual([
      { key: "exclude-third-party", title: "Excluir librerias de terceros", category: "scope", metric: 4, dependsOn: [] },
      { key: "close-sql-injections", title: "Cerrar inyecciones SQL", category: "security", metric: 10, dependsOn: [] },
      { key: "resolve-duplicate-migrations", title: "Resolver migraciones a medias (_new)", category: "debt", metric: 3, dependsOn: [] },
      { key: "add-characterization-tests", title: "Tests de caracterizacion en lo complejo", category: "testing", metric: 20, dependsOn: [] },
      { key: "reduce-n-plus-one", title: "Reducir consultas N+1", category: "database", metric: 30, dependsOn: ["add-characterization-tests"] },
      { key: "extract-data-layer", title: "Extraer capa de acceso a datos", category: "database", metric: 45, dependsOn: ["add-characterization-tests", "close-sql-injections"] },
      { key: "break-god-classes", title: "Romper clases gigantes", category: "complexity", metric: 7, dependsOn: ["add-characterization-tests"] },
      {
        key: "validate-risk-reduction",
        title: "Validar reduccion de riesgo",
        category: "validation",
        metric: 0,
        dependsOn: [
          "exclude-third-party",
          "close-sql-injections",
          "resolve-duplicate-migrations",
          "add-characterization-tests",
          "reduce-n-plus-one",
          "extract-data-layer",
          "break-god-classes",
        ],
      },
    ]);

    expect(plan.every((task) => task.description.length > 0)).toBe(true);
  });

  it("con las senales de un proyecto React genera su roadmap con dependencias", () => {
    const plan = generatePlan(
      signals({
        findingCounts: {
          ...counts({ "manual-copy-file": 18, "possibly-unused-file": 39, "dangerously-set-inner-html": 105 }, "low"),
          "inner-html-assignment": { medium: 8 },
          "untested-component": { high: 75, medium: 90 },
          "http-in-component": { medium: 88 },
          "duplicate-endpoint": { low: 47 },
          "hardcoded-api-url": { medium: 2 },
          "jquery-usage": { medium: 97 },
          "direct-dom-access": { medium: 23 },
          "base-class-inheritance": { medium: 155 },
          "large-component": { medium: 42 },
          "long-render": { medium: 43 },
          "large-state": { medium: 17 },
          "large-class": { medium: 2 },
        },
      }),
    );

    expect(plan.map((task) => ({ key: task.key, title: task.title, category: task.category, metric: task.metric, dependsOn: task.dependsOn }))).toEqual([
      { key: "close-xss-sinks", title: "Cerrar vectores de XSS", category: "security", metric: 113, dependsOn: [] },
      { key: "remove-manual-copies", title: "Eliminar copias manuales", category: "debt", metric: 18, dependsOn: [] },
      { key: "remove-unused-files", title: "Eliminar archivos sin uso", category: "debt", metric: 39, dependsOn: ["remove-manual-copies"] },
      { key: "add-component-tests", title: "Tests de caracterizacion en componentes complejos", category: "testing", metric: 75, dependsOn: [] },
      { key: "break-god-classes", title: "Romper clases gigantes", category: "complexity", metric: 2, dependsOn: ["add-component-tests"] },
      { key: "isolate-http-layer", title: "Aislar las llamadas HTTP en una capa de servicios", category: "api_access", metric: 137, dependsOn: ["add-component-tests"] },
      { key: "remove-jquery", title: "Sacar jQuery y el acceso directo al DOM", category: "coupling", metric: 120, dependsOn: ["add-component-tests"] },
      {
        key: "replace-base-class-inheritance",
        title: "Reemplazar la herencia de la base comun por composicion",
        category: "coupling",
        metric: 155,
        dependsOn: ["add-component-tests", "isolate-http-layer"],
      },
      { key: "split-large-components", title: "Partir componentes gigantes", category: "complexity", metric: 102, dependsOn: ["add-component-tests"] },
      {
        key: "validate-risk-reduction",
        title: "Validar reduccion de riesgo",
        category: "validation",
        metric: 0,
        dependsOn: [
          "close-xss-sinks",
          "remove-manual-copies",
          "remove-unused-files",
          "add-component-tests",
          "break-god-classes",
          "isolate-http-layer",
          "remove-jquery",
          "replace-base-class-inheritance",
          "split-large-components",
        ],
      },
    ]);
    expect(plan.every((task) => task.description.length > 0)).toBe(true);
  });

  it("add-component-tests solo cuenta los componentes sin test de severidad high", () => {
    expect(generatePlan(signals({ findingCounts: { "untested-component": { medium: 90 } } }))).toEqual([]);
    expect(generatePlan(signals({ findingCounts: { "untested-component": { high: 3, medium: 90 } } }))[0]).toMatchObject({
      key: "add-component-tests",
      metric: 3,
    });
  });

  it("close-code-injection suma eval y new Function, de cualquier severidad", () => {
    const [task] = generatePlan(signals({ findingCounts: { "eval-usage": { critical: 2, high: 1 }, "new-function": { critical: 4 } } }));

    expect(task).toMatchObject({
      key: "close-code-injection",
      title: "Eliminar ejecucion dinamica de codigo",
      category: "security",
      metric: 7,
      dependsOn: [],
    });
    expect(task.description).toBe("Reemplazar eval / Function() por logica explicita: compilan codigo desde strings.");
  });
});
