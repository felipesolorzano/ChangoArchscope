import { TASK_RULES, countSelected } from "./planTaskRules.js";
const LEVELS = { none: 0, low: 1, medium: 2, high: 3 };
// Gate "sin pendientes" (<= 0) sobre una cantidad.
const atMostZero = (key, label, value, stack) => ({ key, label, target: 0, comparator: "max", format: "count", stack, value });
// Hallazgos de las reglas de unas tareas (misma fuente que la metrica de la tarea).
const rulesOf = (...taskKeys) => (signals) => countSelected(signals, taskKeys.flatMap((taskKey) => TASK_RULES[taskKey]));
// Trabajo de paquetes: sin reporte de dependencias, no hay datos.
const packagesOf = (taskKey) => (signals) => (signals.dependencies === undefined ? null : (signals.dependencies.counts[taskKey] ?? 0));
// Fases 0–10 en orden. Spec: plan-phases.md.
const PHASES = [
    {
        number: 0,
        key: "baseline",
        title: "Linea base",
        goal: "Todo el codigo propio se analiza",
        gates: [atMostZero("parse-errors", "Archivos que no parsean", (signals) => signals.skippedFiles)],
        tasks: ["exclude-third-party"],
    },
    {
        number: 1,
        key: "security",
        title: "Seguridad",
        goal: "Sin inyecciones, sinks XSS, paquetes vulnerables ni runtime sin soporte",
        gates: [
            atMostZero("injections", "Inyecciones (SQL, eval, Function)", rulesOf("close-sql-injections", "close-code-injection")),
            atMostZero("xss-sinks", "Sinks XSS", rulesOf("close-xss-sinks"), "react"),
            atMostZero("vulnerable-packages", "Paquetes vulnerables", packagesOf("fix-vulnerable-packages")),
            atMostZero("unsupported-runtime", "Runtime sin soporte", packagesOf("update-unsupported-runtime")),
        ],
        tasks: ["close-sql-injections", "close-code-injection", "close-xss-sinks", "fix-vulnerable-packages", "update-unsupported-runtime"],
    },
    {
        number: 2,
        key: "cleanup",
        title: "Limpieza",
        goal: "Sin copias, archivos muertos ni migraciones a medias",
        gates: [
            atMostZero("manual-copies", "Copias manuales", rulesOf("remove-manual-copies")),
            atMostZero("unused-files", "Archivos sin uso", rulesOf("remove-unused-files")),
            atMostZero("duplicate-migrations", "Migraciones a medias (_new)", (signals) => signals.duplicatePairs),
            atMostZero("unused-exports", "Exports sin uso", rulesOf("remove-unused-exports"), "react"),
            atMostZero("unused-packages", "Paquetes sin uso", packagesOf("remove-unused-packages")),
        ],
        tasks: ["remove-manual-copies", "remove-unused-files", "resolve-duplicate-migrations", "remove-unused-exports", "remove-unused-packages"],
    },
    {
        number: 3,
        key: "safety-net",
        title: "Red de seguridad",
        goal: "Lo mas riesgoso tiene tests antes de tocarlo",
        gates: [
            {
                key: "protection-level",
                label: "Nivel de proteccion",
                target: LEVELS.low,
                comparator: "min",
                format: "level",
                value: (signals) => (signals.protectionLevel == null ? null : LEVELS[signals.protectionLevel]),
            },
            atMostZero("top-risk-untested", "Sin tests entre los 10 mas riesgosos", (signals) => signals.topRiskUntested ?? null),
        ],
        tasks: ["add-characterization-tests", "add-component-tests"],
    },
    {
        number: 4,
        key: "architecture",
        title: "Arquitectura",
        goal: "Sin ciclos de imports",
        gates: [atMostZero("import-cycles", "Ciclos de imports", rulesOf("break-import-cycles"))],
        tasks: ["break-import-cycles"],
    },
    {
        number: 5,
        key: "removed-apis",
        title: "APIs eliminadas",
        goal: "Nada que rompa al subir de version",
        gates: [atMostZero("removed-apis", "Usos de APIs eliminadas", rulesOf("apply-legacy-codemods"))],
        tasks: ["apply-legacy-codemods"],
    },
    {
        number: 6,
        key: "deprecated-apis",
        title: "APIs y librerias deprecadas",
        goal: "Sin APIs deprecadas ni paquetes abandonados",
        gates: [
            atMostZero("deprecated-apis", "Usos de APIs deprecadas", rulesOf("migrate-deprecated-apis")),
            atMostZero("abandoned-packages", "Paquetes abandonados", packagesOf("replace-abandoned-packages")),
        ],
        tasks: ["migrate-deprecated-apis", "replace-abandoned-packages"],
    },
    {
        number: 7,
        key: "decoupling",
        title: "Desacople",
        goal: "Sin jQuery ni herencia de clases base propias",
        gates: [
            atMostZero("jquery", "jQuery / DOM directo", rulesOf("remove-jquery"), "react"),
            atMostZero("base-classes", "Herencia de clases base", rulesOf("replace-base-class-inheritance"), "react"),
        ],
        tasks: ["remove-jquery", "replace-base-class-inheritance"],
    },
    {
        number: 8,
        key: "data-http",
        title: "Datos y HTTP",
        goal: "Acceso a datos y HTTP en su capa",
        gates: [
            atMostZero("n-plus-one", "Consultas N+1", rulesOf("reduce-n-plus-one"), "laravel"),
            atMostZero("data-layer", "SQL fuera de infraestructura / duplicado", rulesOf("extract-data-layer"), "laravel"),
            atMostZero("http-layer", "HTTP en componentes / duplicado / URL fija", rulesOf("isolate-http-layer"), "react"),
        ],
        tasks: ["reduce-n-plus-one", "extract-data-layer", "isolate-http-layer"],
    },
    {
        number: 9,
        key: "complexity",
        title: "Complejidad",
        goal: "Sin clases ni componentes gigantes",
        gates: [
            atMostZero("god-classes", "Clases gigantes", rulesOf("break-god-classes")),
            atMostZero("large-components", "Componentes grandes", rulesOf("split-large-components"), "react"),
        ],
        tasks: ["break-god-classes", "split-large-components"],
    },
    {
        number: 10,
        key: "upgrade",
        title: "Actualizacion y validacion",
        goal: "Versiones al dia y la mayoria del codigo sano",
        gates: [
            atMostZero("major-updates", "Saltos de version mayor pendientes", packagesOf("upgrade-major-versions")),
            { key: "healthy-files", label: "Archivos sanos", target: 80, comparator: "min", format: "percent", value: (signals) => signals.healthyPercent ?? null },
        ],
        tasks: ["apply-safe-updates", "upgrade-major-versions", "validate-risk-reduction"],
    },
];
/** Fases del stack con sus gates evaluados; la actual es la primera no cumplida. */
export function planPhases(signals, stack, taskKeys) {
    const present = new Set(taskKeys);
    let currentFound = false;
    return PHASES.map(({ gates, tasks, ...phase }) => {
        const evaluated = gates.filter((gate) => (gate.stack ?? stack) === stack).map((gate) => evaluateGate(gate, signals));
        const status = phaseStatus(evaluated);
        const current = !currentFound && (status === "failed" || status === "unknown");
        currentFound ||= current;
        return { ...phase, status, current, gates: evaluated, tasks: tasks.filter((task) => present.has(task)) };
    });
}
function evaluateGate({ stack: _stack, value: valueOf, ...gate }, signals) {
    const value = valueOf(signals);
    if (value === null) {
        return { ...gate, value, status: "unknown" };
    }
    const passed = gate.comparator === "max" ? value <= gate.target : value >= gate.target;
    return { ...gate, value, status: passed ? "passed" : "failed" };
}
function phaseStatus(gates) {
    if (gates.length === 0)
        return "not-applicable";
    if (gates.some((gate) => gate.status === "failed"))
        return "failed";
    return gates.some((gate) => gate.status === "unknown") ? "unknown" : "passed";
}
