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

describe("generatePlan: APIs legacy (XRay X6)", () => {
  it("codemods compatibles y deprecadas antes de actualizar; createRoot despues de los majors", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({
          "unsafe-lifecycle": 1, "find-dom-node": 2, "string-ref": 4, "removed-php-function": 8,
          "with-router": 16, "deprecated-library": 32, "deprecated-php-function": 64, "legacy-react-dom-api": 128,
          "base-class-inheritance": 1, "untested-complex-method": 1,
        }),
        dependencies: { counts: { "upgrade-major-versions": 1 }, items: {} },
      }),
    );
    const keys = plan.map((task) => task.key);

    expect(keys).toEqual([
      "add-characterization-tests",
      "apply-legacy-codemods",
      "migrate-deprecated-apis",
      "replace-base-class-inheritance",
      "upgrade-major-versions",
      "apply-post-upgrade-codemods",
      "validate-risk-reduction",
    ]);
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));
    expect(byKey["apply-legacy-codemods"]).toEqual({
      key: "apply-legacy-codemods",
      title: "Aplicar codemods compatibles (antes de actualizar)",
      description: "Con los tests en verde: lifecycles, string refs, findDOMNode y funciones PHP eliminadas tienen reemplazo en la version actual.",
      category: "legacy_api",
      dependsOn: ["add-characterization-tests"],
      metric: 15,
    });
    expect(byKey["migrate-deprecated-apis"]).toEqual({
      key: "migrate-deprecated-apis",
      title: "Migrar APIs y librerias deprecadas",
      description: "withRouter, moment/request/react-ga, utf8_encode: migracion manual guiada por el panel Codemods, antes de subir versiones.",
      category: "legacy_api",
      dependsOn: ["apply-legacy-codemods", "add-characterization-tests"],
      metric: 112,
    });
    expect(byKey["apply-post-upgrade-codemods"]).toEqual({
      key: "apply-post-upgrade-codemods",
      title: "Aplicar codemods de la version nueva",
      description: "Despues de subir React: ReactDOM.render / hydrate → createRoot.",
      category: "legacy_api",
      dependsOn: ["upgrade-major-versions"],
      metric: 128,
    });
  });

  it("con tests de componentes tambien dependen de add-component-tests", () => {
    const plan = generatePlan(signals({ findingCounts: counts({ "with-router": 1, "unsafe-lifecycle": 1, "legacy-react-dom-api": 1, "untested-component": 1 }) }));
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));

    expect(byKey["apply-legacy-codemods"].dependsOn).toEqual(["add-component-tests"]);
    expect(byKey["migrate-deprecated-apis"].dependsOn).toEqual(["apply-legacy-codemods", "add-component-tests"]);
    expect(byKey["apply-post-upgrade-codemods"].dependsOn).toEqual(["add-component-tests"]);
  });
});

describe("generatePlan: el flujo (XRay X6)", () => {
  it("seguridad del codigo espera a los tests", () => {
    const plan = generatePlan(
      signals({ findingCounts: counts({ "sql-concatenation": 1, "eval-usage": 1, "dangerously-set-inner-html": 1, "untested-complex-method": 1, "untested-component": 1 }) }),
    );
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));

    expect(byKey["close-sql-injections"].dependsOn).toEqual(["add-characterization-tests"]);
    expect(byKey["close-code-injection"].dependsOn).toEqual(["add-characterization-tests", "add-component-tests"]);
    expect(byKey["close-xss-sinks"].dependsOn).toEqual(["add-component-tests"]);
  });

  it("paquetes y runtime esperan a las APIs que se migran antes de actualizar", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "unsafe-lifecycle": 1, "with-router": 1, "untested-complex-method": 1 }),
        dependencies: { counts: { "fix-vulnerable-packages": 1, "apply-safe-updates": 1, "update-unsupported-runtime": 1 }, items: {} },
      }),
    );
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));

    expect(byKey["fix-vulnerable-packages"].dependsOn).toEqual(["add-characterization-tests", "apply-legacy-codemods", "migrate-deprecated-apis"]);
    expect(byKey["apply-safe-updates"].dependsOn).toEqual(["fix-vulnerable-packages", "add-characterization-tests", "apply-legacy-codemods", "migrate-deprecated-apis"]);
    expect(byKey["update-unsupported-runtime"].dependsOn).toEqual(["apply-safe-updates", "add-characterization-tests", "apply-legacy-codemods", "migrate-deprecated-apis"]);
  });
});

describe("generatePlan: exports sin uso (XRay X2)", () => {
  it("remove-unused-exports cuenta unused-export, va despues de remove-unused-files y depende de ella", () => {
    const plan = generatePlan(signals({ findingCounts: counts({ "unused-export": 40, "possibly-unused-file": 2 }) }));
    const keys = plan.map((task) => task.key);

    expect(keys.indexOf("remove-unused-exports")).toBe(keys.indexOf("remove-unused-files") + 1);
    expect(plan.find((task) => task.key === "remove-unused-exports")).toMatchObject({
      title: "Eliminar exports sin uso",
      category: "debt",
      metric: 40,
      dependsOn: ["remove-unused-files"],
    });
    expect(plan.find((task) => task.key === "remove-unused-exports")?.description).not.toBe("");
  });
});

describe("generatePlan: ciclos de dependencias (XRay X1)", () => {
  it("break-import-cycles cuenta import-cycle, va despues de los tests y espera a ellos", () => {
    const plan = generatePlan(signals({ findingCounts: counts({ "import-cycle": 3, "possibly-unused-file": 1, "untested-component": 2, "untested-complex-method": 1 }) }));
    const keys = plan.map((task) => task.key);

    expect(keys.indexOf("break-import-cycles")).toBe(keys.indexOf("add-component-tests") + 1);
    expect(plan.find((task) => task.key === "break-import-cycles")).toMatchObject({
      title: "Romper ciclos de dependencias",
      category: "architecture",
      metric: 3,
      dependsOn: ["add-characterization-tests", "add-component-tests"],
    });
    expect(plan.find((task) => task.key === "break-import-cycles")?.description).not.toBe("");
  });
});

describe("generatePlan: un major a la vez (XRay X6)", () => {
  const majors = (steps: Record<string, string[]>) => ({
    counts: { "apply-safe-updates": 1, "upgrade-major-versions": 9, ...Object.fromEntries(Object.entries(steps).map(([key, list]) => [key, list.length])) },
    items: Object.fromEntries(Object.entries(steps).map(([key, list]) => [key, list.map((message) => ({ file: "", line: 0, rule: "dependency-major", severity: "medium", message }))])),
    majorSteps: Object.keys(steps),
  });

  it("una tarea por paso, encadenadas, en el lugar de upgrade-major-versions", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "legacy-react-dom-api": 1, "untested-component": 1 }),
        dependencies: majors({
          "upgrade-major:react": ["react 16.0.0 → 19.0.0 (grupo react)", "react-dom 16.0.0 → 19.0.0 (grupo react)"],
          "upgrade-major:otros": ["a 1 → 2", "b 1 → 2", "c 1 → 2", "d 1 → 2", "e 1 → 2"],
        }),
      }),
    );

    expect(plan.map((task) => task.key)).toEqual([
      "add-component-tests",
      "apply-safe-updates",
      "upgrade-major:react",
      "upgrade-major:otros",
      "apply-post-upgrade-codemods",
      "validate-risk-reduction",
    ]);
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));
    expect(byKey["upgrade-major:react"]).toEqual({
      key: "upgrade-major:react",
      title: "Migrar major: react",
      description: "react 16.0.0 → 19.0.0, react-dom 16.0.0 → 19.0.0. Un salto a la vez: tests verdes antes y despues.",
      category: "dependencies",
      dependsOn: ["apply-safe-updates", "add-component-tests"],
      metric: 2,
    });
    expect(byKey["upgrade-major:otros"]).toMatchObject({
      title: "Migrar majors sueltos",
      description: "a 1 → 2, b 1 → 2, c 1 → 2 (+2). Un salto a la vez: tests verdes antes y despues.",
      dependsOn: ["upgrade-major:react", "apply-safe-updates", "add-component-tests"],
      metric: 5,
    });
    expect(byKey["apply-post-upgrade-codemods"].dependsOn).toEqual(["upgrade-major:react", "upgrade-major:otros", "add-component-tests"]);
  });

  it("tres saltos sin (+0); con runtime y tests de caracterizacion tambien dependen de ellos", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "untested-complex-method": 1 }),
        dependencies: { ...majors({ "upgrade-major:eslint": ["a 1 → 2", "b 1 → 2", "c 1 → 2"] }), counts: { "update-unsupported-runtime": 1, "upgrade-major-versions": 3 } },
      }),
    );

    expect(plan.find((task) => task.key === "upgrade-major:eslint")).toMatchObject({
      description: "a 1 → 2, b 1 → 2, c 1 → 2. Un salto a la vez: tests verdes antes y despues.",
      dependsOn: ["update-unsupported-runtime", "add-characterization-tests"],
      metric: 3,
    });
  });

  it("sin pasos con datos no hay tareas de major; sin majorSteps queda la tarea unica", () => {
    const empty = generatePlan(signals({ dependencies: { ...majors({}), counts: { "upgrade-major-versions": 3 } } }));
    expect(empty.map((task) => task.key)).toEqual([]);

    const legacy = generatePlan(signals({ dependencies: { counts: { "upgrade-major-versions": 3 }, items: {} } }));
    expect(legacy.map((task) => task.key)).toEqual(["upgrade-major-versions", "validate-risk-reduction"]);
  });
});

describe("generatePlan con tareas de dependencias", () => {
  const dependencies = (counts: Record<string, number>) => ({ counts, items: {} });

  it("sin señales de dependencias no hay tareas de dependencias", () => {
    expect(generatePlan(signals({ dependencies: dependencies({}) }))).toEqual([]);
  });

  it("cada tarea de dependencias con su metrica, orden de roadmap y dependencias podadas", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "sql-concatenation": 1, "untested-component": 5, "large-component": 2 }),
        duplicatePairs: 1,
        dependencies: dependencies({
          "fix-vulnerable-packages": 3,
          "update-unsupported-runtime": 1,
          "remove-unused-packages": 7,
          "replace-abandoned-packages": 2,
          "apply-safe-updates": 9,
          "upgrade-major-versions": 4,
        }),
      }),
    );

    expect(plan.map((task) => task.key)).toEqual([
      "resolve-duplicate-migrations",
      "remove-unused-packages",
      "add-component-tests",
      "close-sql-injections",
      "fix-vulnerable-packages",
      "apply-safe-updates",
      "update-unsupported-runtime",
      "upgrade-major-versions",
      "replace-abandoned-packages",
      "split-large-components",
      "validate-risk-reduction",
    ]);

    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));
    expect(byKey["fix-vulnerable-packages"]).toMatchObject({ category: "dependencies", metric: 3, dependsOn: ["add-component-tests"], title: "Corregir paquetes vulnerables" });
    expect(byKey["update-unsupported-runtime"]).toMatchObject({ metric: 1, dependsOn: ["apply-safe-updates", "add-component-tests"], title: "Actualizar runtime sin soporte" });
    expect(byKey["remove-unused-packages"]).toMatchObject({ metric: 7, dependsOn: [], title: "Quitar dependencias sin uso" });
    expect(byKey["replace-abandoned-packages"]).toMatchObject({ metric: 2, dependsOn: ["apply-safe-updates", "add-component-tests"], title: "Reemplazar paquetes abandonados o deprecated" });
    expect(byKey["apply-safe-updates"]).toMatchObject({ metric: 9, dependsOn: ["fix-vulnerable-packages", "remove-unused-packages", "add-component-tests"], title: "Aplicar actualizaciones patch y minor" });
    expect(byKey["upgrade-major-versions"]).toMatchObject({
      metric: 4,
      dependsOn: ["apply-safe-updates", "update-unsupported-runtime", "add-component-tests"],
      title: "Migrar versiones major",
    });
    expect(byKey["replace-abandoned-packages"].description).not.toBe("");
    expect(plan.every((task) => task.description.length > 0)).toBe(true);
  });

  it("los majors y los reemplazos esperan a los tests de caracterizacion si existen", () => {
    const plan = generatePlan(
      signals({
        findingCounts: counts({ "untested-complex-method": 3 }),
        dependencies: dependencies({ "replace-abandoned-packages": 1, "upgrade-major-versions": 1 }),
      }),
    );
    const byKey = Object.fromEntries(plan.map((task) => [task.key, task]));

    expect(byKey["replace-abandoned-packages"].dependsOn).toEqual(["add-characterization-tests"]);
    expect(byKey["upgrade-major-versions"].dependsOn).toEqual(["add-characterization-tests"]);
  });

  it("una sola tarea de dependencias tambien genera el validate final", () => {
    expect(generatePlan(signals({ dependencies: dependencies({ "upgrade-major-versions": 1 }) })).map((task) => [task.key, task.dependsOn])).toEqual([
      ["upgrade-major-versions", []],
      ["validate-risk-reduction", ["upgrade-major-versions"]],
    ]);
  });
});

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
      { key: "resolve-duplicate-migrations", title: "Resolver migraciones a medias (_new)", category: "debt", metric: 3, dependsOn: [] },
      { key: "add-characterization-tests", title: "Tests de caracterizacion en lo complejo", category: "testing", metric: 20, dependsOn: [] },
      { key: "close-sql-injections", title: "Cerrar inyecciones SQL", category: "security", metric: 10, dependsOn: ["add-characterization-tests"] },
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
          "resolve-duplicate-migrations",
          "add-characterization-tests",
          "close-sql-injections",
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
      { key: "remove-manual-copies", title: "Eliminar copias manuales", category: "debt", metric: 18, dependsOn: [] },
      { key: "remove-unused-files", title: "Eliminar archivos sin uso", category: "debt", metric: 39, dependsOn: ["remove-manual-copies"] },
      { key: "add-component-tests", title: "Tests de caracterizacion en componentes complejos", category: "testing", metric: 75, dependsOn: [] },
      { key: "close-xss-sinks", title: "Cerrar vectores de XSS", category: "security", metric: 113, dependsOn: ["add-component-tests"] },
      { key: "isolate-http-layer", title: "Aislar las llamadas HTTP en una capa de servicios", category: "api_access", metric: 137, dependsOn: ["add-component-tests"] },
      { key: "remove-jquery", title: "Sacar jQuery y el acceso directo al DOM", category: "coupling", metric: 120, dependsOn: ["add-component-tests"] },
      {
        key: "replace-base-class-inheritance",
        title: "Reemplazar la herencia de la base comun por composicion",
        category: "coupling",
        metric: 155,
        dependsOn: ["add-component-tests", "isolate-http-layer"],
      },
      { key: "break-god-classes", title: "Romper clases gigantes", category: "complexity", metric: 2, dependsOn: ["add-component-tests"] },
      { key: "split-large-components", title: "Partir componentes gigantes", category: "complexity", metric: 102, dependsOn: ["add-component-tests"] },
      {
        key: "validate-risk-reduction",
        title: "Validar reduccion de riesgo",
        category: "validation",
        metric: 0,
        dependsOn: [
          "remove-manual-copies",
          "remove-unused-files",
          "add-component-tests",
          "close-xss-sinks",
          "isolate-http-layer",
          "remove-jquery",
          "replace-base-class-inheritance",
          "break-god-classes",
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
