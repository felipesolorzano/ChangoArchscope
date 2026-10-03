import type { DependencyReportEntry, DependencyReportResult, SelectedRuntime } from "../../../dependencies/application/use-cases/buildDependencyReport.js";
import type { SupportStatus } from "../../../dependencies/domain/value-objects/Security.js";
import semver from "semver";

import type { DependencySignals, PlanFinding } from "../../domain/value-objects/Plan.js";

// Adaptador entre bounded contexts: el reporte de `dependencies` → tareas del plan (metrica + items).
const KIND_LABELS: Record<SelectedRuntime["kind"], string> = { php: "PHP", node: "Node", npm: "npm" };

export function dependencyReportToSignals(report: DependencyReportResult): DependencySignals {
  const deps = report.dependencies;
  // XRay X6: las criticas van al carril de hotfix; el resto sigue el flujo.
  const isCritical = (dep: DependencyReportEntry) => dep.security.maxSeverity === "critical";
  const items: Record<string, PlanFinding[]> = {
    "hotfix-critical-packages": deps.filter(isCritical).map(criticalItem),
    "fix-vulnerable-packages": deps.filter((dep) => dep.security.vulnerabilities.length > 0 && !isCritical(dep)).map(vulnerableItem),
    "update-unsupported-runtime": report.runtimes.filter((runtime) => runtime.support?.isEol === true).map(runtimeItem),
    "replace-abandoned-packages": deps.filter((dep) => dep.status === "abandoned" || dep.status === "deprecated").map(abandonedItem),
    "remove-unused-packages": deps.filter((dep) => dep.usage?.unused === true).map((dep) => item(dep, "dependency-unused", "low", `${dep.name}: sin referencias en el codigo`)),
    "apply-safe-updates": deps.filter((dep) => dep.status === "patch" || dep.status === "minor").map((dep) => item(dep, `dependency-${dep.status}`, "low", jump(dep))),
    "upgrade-major-versions": deps.filter((dep) => dep.status === "major").map((dep) => item(dep, "dependency-major", "medium", `${jump(dep)}${dep.group ? ` (grupo ${dep.group})` : ""}`)),
  };

  const majorSteps = majorStepsOf(deps.filter((dep) => dep.status === "major"));
  for (const [key, list] of majorSteps) {
    items[key] = list;
  }

  return { counts: Object.fromEntries(Object.entries(items).map(([key, list]) => [key, list.length])), items, majorSteps: majorSteps.map(([key]) => key) };
}

// XRay X6: un major a la vez. Primero herramientas, despues el framework y lo que lo acompaña, despues
// el resto de los grupos (alfabetico) y al final los sueltos.
const STEP_ORDER = ["eslint", "jest", "vite", "webpack", "gulp", "react", "@testing-library", "react-router", "laravel"];
const LOOSE = "otros";

function majorStepsOf(majors: DependencyReportEntry[]): Array<[string, PlanFinding[]]> {
  const byGroup = new Map<string, DependencyReportEntry[]>();
  for (const dep of majors) {
    const group = dep.group ?? LOOSE;
    byGroup.set(group, [...(byGroup.get(group) ?? []), dep]);
  }
  const rank = (group: string) => (group === LOOSE ? STEP_ORDER.length + 1 : STEP_ORDER.includes(group) ? STEP_ORDER.indexOf(group) : STEP_ORDER.length);

  return [...byGroup]
    .sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
    .flatMap(([group, list]) => (HOP_GROUPS.has(group) ? hopSteps(group, list) : null) ?? [[`upgrade-major:${group}`, list.map(groupedItem)]]);
}

// Frameworks: cada major tiene su guia de migracion, asi que van de a un major por paso.
const HOP_GROUPS = new Set(["react", "react-router", "laravel"]);

function hopSteps(group: string, list: DependencyReportEntry[]): Array<[string, PlanFinding[]]> | null {
  // Lider: el que se llama como el grupo; si no, el que pasa por mas majors (empate, el primero).
  const lead = list.find((dep) => dep.name === group) ?? list.reduce((best, dep) => (dep.majorPath.length > best.majorPath.length ? dep : best));
  if (lead.majorPath.length === 0) {
    return null;
  }
  const reached = new Map(list.map((dep) => [dep, dep.current as string]));

  return lead.majorPath.map((version, index) => {
    const major = semver.major(version);
    const last = index === lead.majorPath.length - 1;
    const jumpTo = (dep: DependencyReportEntry, target: string) => {
      const from = reached.get(dep)!;
      reached.set(dep, target);
      return item(dep, "dependency-major", "medium", `${dep.name} ${from} → ${target}`);
    };
    const inMajor = list.flatMap((dep) => dep.majorPath.filter((candidate) => semver.major(candidate) === major).map((target) => jumpTo(dep, target)));
    // El ultimo paso lleva a cada paquete a su recomendada (los que no compartieron un major con el lider,
    // o los que siguen mas alla).
    const leftovers = last ? list.filter((dep) => reached.get(dep) !== dep.recommended).map((dep) => jumpTo(dep, dep.recommended as string)) : [];
    return [`upgrade-major:${group}@${major}`, [...inMajor, ...leftovers]];
  });
}

// Grupos sin pasos intermedios: un item por paquete, con el camino de majors si pasa por mas de uno.
function groupedItem(dep: DependencyReportEntry): PlanFinding {
  const majors = dep.majorPath.map((version) => semver.major(version)).join(" → ");
  const path = dep.majorPath.length > 1 ? ` (majors: ${majors})` : "";
  return item(dep, "dependency-major", "medium", `${jump(dep)}${dep.group ? ` (grupo ${dep.group})` : ""}${path}`);
}

function item(dep: DependencyReportEntry, rule: string, severity: string, message: string): PlanFinding {
  return { file: dep.manifest, line: 0, rule, severity, message };
}

function jump(dep: DependencyReportEntry): string {
  return `${dep.name} ${dep.current} → ${dep.recommended}`;
}

function vulnerableItem(dep: DependencyReportEntry): PlanFinding {
  const { vulnerabilities, maxSeverity } = dep.security;
  const first = vulnerabilities[0];
  const severity = maxSeverity === "moderate" ? "medium" : (maxSeverity as string);

  return item(dep, "dependency-vulnerable", severity, `${dep.name} ${dep.current} → ${dep.recommended ?? "-"}: ${vulnerabilities.length} vulns (${first.cve ?? first.id})`);
}

// Parche minimo: la version que corrige la primera vulnerabilidad critica.
function criticalItem(dep: DependencyReportEntry): PlanFinding {
  const critical = dep.security.vulnerabilities.filter((vulnerability) => vulnerability.severity === "critical");
  const [first] = critical;
  const version = first.fixedIn ?? dep.recommended ?? "-";

  return item(dep, "dependency-critical", "critical", `${dep.name} ${dep.current} → ${version}: ${critical.length} vulns criticas (${first.cve ?? first.id})`);
}

function abandonedItem(dep: DependencyReportEntry): PlanFinding {
  return item(dep, `dependency-${dep.status}`, "high", `${dep.name} ${dep.current}: ${dep.replacement ?? dep.deprecation ?? "abandonado"}`);
}

function runtimeItem(runtime: SelectedRuntime): PlanFinding {
  // Solo llegan runtimes con soporte vencido (support presente).
  const eol = (runtime.support as SupportStatus).eol;
  const since = typeof eol === "string" ? ` desde ${eol}` : "";

  return { file: "", line: 0, rule: "runtime-eol", severity: "high", message: `${KIND_LABELS[runtime.kind]} ${runtime.selected}: sin soporte${since}` };
}
