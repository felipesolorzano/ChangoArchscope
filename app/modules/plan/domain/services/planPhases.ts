import type { PlanGate, PlanPhase, PlanProtectionLevel, PlanSignals, PlanStack } from "../value-objects/Plan.js";
import { TASK_RULES, countSelected } from "./planTaskRules.js";

type GateTemplate = Omit<PlanGate, "value" | "status"> & { stack?: PlanStack; value: (signals: PlanSignals) => number | null };
type PhaseTemplate = Omit<PlanPhase, "status" | "current" | "gates" | "tasks"> & { gates: GateTemplate[]; tasks: string[] };

const LEVELS: Record<PlanProtectionLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
// Stryker disable next-line StringLiteral: la constante se usa igual en la fase y al expandir, mutante equivalente.
const MAJOR_STEPS = "upgrade-major:*";

// Gate "sin pendientes" (<= 0) sobre una cantidad.
const atMostZero = (key: string, label: string, value: GateTemplate["value"], stack?: PlanStack): GateTemplate => ({ key, label, target: 0, comparator: "max", format: "count", stack, value });
// Hallazgos de las reglas de unas tareas (misma fuente que la metrica de la tarea).
const rulesOf = (...taskKeys: string[]) => (signals: PlanSignals) => countSelected(signals, taskKeys.flatMap((taskKey) => TASK_RULES[taskKey]));
// Trabajo de paquetes: sin reporte de dependencias, no hay datos.
const packagesOf = (taskKey: string) => (signals: PlanSignals) => (signals.dependencies === undefined ? null : (signals.dependencies.counts[taskKey] ?? 0));

// Fases 0–10 en el orden del flujo: limpiar, proteger, arreglar codigo sin tocar versiones, actualizar
// de menor a mayor y recien despues adoptar lo de la version nueva. Spec: plan-phases.md.
const PHASES: PhaseTemplate[] = [
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
    number: 2,
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
    number: 3,
    key: "security",
    title: "Seguridad del codigo",
    goal: "Sin inyecciones ni sinks XSS, con los tests como red",
    gates: [
      atMostZero("injections", "Inyecciones (SQL, eval, Function)", rulesOf("close-sql-injections", "close-code-injection")),
      atMostZero("xss-sinks", "Sinks XSS", rulesOf("close-xss-sinks"), "react"),
    ],
    tasks: ["close-sql-injections", "close-code-injection", "close-xss-sinks"],
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
    key: "pre-upgrade-apis",
    title: "APIs legacy (antes de actualizar)",
    goal: "Migrar lo que ya tiene reemplazo en la version actual",
    gates: [
      atMostZero("removed-apis", "APIs eliminadas con reemplazo actual", rulesOf("apply-legacy-codemods")),
      atMostZero("deprecated-apis", "APIs y librerias deprecadas", rulesOf("migrate-deprecated-apis")),
    ],
    tasks: ["apply-legacy-codemods", "migrate-deprecated-apis"],
  },
  {
    number: 6,
    key: "layers",
    title: "Desacople y capas",
    goal: "jQuery, herencia, HTTP y datos en su capa",
    gates: [
      atMostZero("jquery", "jQuery / DOM directo", rulesOf("remove-jquery"), "react"),
      atMostZero("base-classes", "Herencia de clases base", rulesOf("replace-base-class-inheritance"), "react"),
      atMostZero("http-layer", "HTTP en componentes / duplicado / URL fija", rulesOf("isolate-http-layer"), "react"),
      atMostZero("n-plus-one", "Consultas N+1", rulesOf("reduce-n-plus-one"), "laravel"),
      atMostZero("data-layer", "SQL fuera de infraestructura / duplicado", rulesOf("extract-data-layer"), "laravel"),
    ],
    tasks: ["isolate-http-layer", "remove-jquery", "replace-base-class-inheritance", "reduce-n-plus-one", "extract-data-layer"],
  },
  {
    number: 7,
    key: "safe-updates",
    title: "Paquetes vulnerables y patch/minor",
    goal: "Actualizaciones que no rompen, con los tests en verde",
    gates: [
      atMostZero("vulnerable-packages", "Paquetes vulnerables", packagesOf("fix-vulnerable-packages")),
      atMostZero("safe-updates", "Actualizaciones patch/minor pendientes", packagesOf("apply-safe-updates")),
    ],
    tasks: ["fix-vulnerable-packages", "apply-safe-updates"],
  },
  {
    number: 8,
    key: "major-upgrades",
    title: "Runtime y versiones major",
    goal: "Un salto a la vez, con tests verdes antes y despues",
    gates: [
      atMostZero("unsupported-runtime", "Runtime sin soporte", packagesOf("update-unsupported-runtime")),
      atMostZero("major-updates", "Saltos de version mayor pendientes", packagesOf("upgrade-major-versions")),
      atMostZero("abandoned-packages", "Paquetes abandonados", packagesOf("replace-abandoned-packages")),
    ],
    tasks: ["update-unsupported-runtime", "upgrade-major-versions", MAJOR_STEPS, "replace-abandoned-packages"],
  },
  {
    number: 9,
    key: "post-upgrade-apis",
    title: "APIs de la version nueva",
    goal: "Adoptar lo que exige la version nueva",
    gates: [atMostZero("post-upgrade-apis", "APIs a migrar despues de actualizar", rulesOf("apply-post-upgrade-codemods"), "react")],
    tasks: ["apply-post-upgrade-codemods"],
  },
  {
    number: 10,
    key: "validation",
    title: "Complejidad y validacion",
    goal: "Sin piezas gigantes y la mayoria del codigo sano",
    gates: [
      atMostZero("god-classes", "Clases gigantes", rulesOf("break-god-classes")),
      atMostZero("large-components", "Componentes grandes", rulesOf("split-large-components"), "react"),
      { key: "healthy-files", label: "Archivos sanos", target: 80, comparator: "min", format: "percent", value: (signals) => signals.healthyPercent ?? null },
    ],
    tasks: ["break-god-classes", "split-large-components", "validate-risk-reduction"],
  },
];

/** Fases del stack con sus gates evaluados; la actual es la primera no cumplida. */
export function planPhases(signals: PlanSignals, stack: PlanStack, taskKeys: string[]): PlanPhase[] {
  const present = new Set(taskKeys);
  let currentFound = false;

  return PHASES.map(({ gates, tasks, ...phase }) => {
    const evaluated = gates.filter((gate) => (gate.stack ?? stack) === stack).map((gate) => evaluateGate(gate, signals));
    const status = phaseStatus(evaluated);
    const current = !currentFound && (status === "failed" || status === "unknown");
    currentFound ||= current;

    // El comodin = los pasos de major del plan, en su orden.
    const planned = tasks.flatMap((task) => (task === MAJOR_STEPS ? taskKeys.filter((key) => key.startsWith("upgrade-major:")) : present.has(task) ? [task] : []));
    return { ...phase, status, current, gates: evaluated, tasks: planned };
  });
}

function evaluateGate({ stack: _stack, value: valueOf, ...gate }: GateTemplate, signals: PlanSignals): PlanGate {
  const value = valueOf(signals);
  if (value === null) {
    return { ...gate, value, status: "unknown" };
  }
  const passed = gate.comparator === "max" ? value <= gate.target : value >= gate.target;

  return { ...gate, value, status: passed ? "passed" : "failed" };
}

function phaseStatus(gates: PlanGate[]): PlanPhase["status"] {
  if (gates.length === 0) return "not-applicable";
  if (gates.some((gate) => gate.status === "failed")) return "failed";
  return gates.some((gate) => gate.status === "unknown") ? "unknown" : "passed";
}
