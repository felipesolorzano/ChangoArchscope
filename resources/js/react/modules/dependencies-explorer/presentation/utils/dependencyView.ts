import type {
  DependencyEntry,
  DependencyStatus,
  DependencySummaryData,
  RuntimeKind,
  SelectedRuntime,
  Severity,
  SupportStatus,
} from "../../domain/value-objects/DependencyReport";

export const STATUS_ORDER: DependencyStatus[] = ["abandoned", "deprecated", "major", "minor", "patch", "unknown", "up_to_date"];

const STATUS_LABELS: Record<DependencyStatus, string> = {
  abandoned: "Abandonado",
  deprecated: "Deprecated",
  major: "Major",
  minor: "Minor",
  patch: "Patch",
  unknown: "Desconocido",
  up_to_date: "Al dia",
};

const STATUS_COLORS: Record<DependencyStatus, string> = {
  abandoned: "#dc2626",
  deprecated: "#dc2626",
  major: "#ea580c",
  minor: "#d97706",
  patch: "#ca8a04",
  unknown: "#64748b",
  up_to_date: "#16a34a",
};

export function statusLabel(status: DependencyStatus): string {
  return STATUS_LABELS[status];
}

export function statusColor(status: DependencyStatus): string {
  return STATUS_COLORS[status];
}

export function dependencyKey(dependency: Pick<DependencyEntry, "ecosystem" | "name">): string {
  return `${dependency.ecosystem}:${dependency.name}`;
}

export type DependencyFiltersState = { status: DependencyStatus | "all"; query: string; hideDev: boolean; onlyVulnerable: boolean };

export function filterDependencies(dependencies: DependencyEntry[], { status, query, hideDev, onlyVulnerable }: DependencyFiltersState): DependencyEntry[] {
  const needle = query.trim().toLowerCase();

  return dependencies.filter(
    (dependency) =>
      (status === "all" || dependency.status === status) &&
      dependency.name.toLowerCase().includes(needle) &&
      !(hideDev && dependency.dev) &&
      !(onlyVulnerable && dependency.security.vulnerabilities.length === 0),
  );
}

const SEVERITY_LABELS: Record<Severity, string> = { critical: "Critica", high: "Alta", moderate: "Moderada", low: "Baja", unknown: "Desconocida" };
const SEVERITY_COLORS: Record<Severity, string> = { critical: "#991b1b", high: "#dc2626", moderate: "#ea580c", low: "#ca8a04", unknown: "#64748b" };

export function severityLabel(severity: Severity): string {
  return SEVERITY_LABELS[severity];
}

export function severityColor(severity: Severity): string {
  return SEVERITY_COLORS[severity];
}

export function securityBadge(dependency: DependencyEntry): string {
  const { vulnerabilities, maxSeverity } = dependency.security;

  if (vulnerabilities.length === 0) {
    return "";
  }
  return `${vulnerabilities.length} ${vulnerabilities.length === 1 ? "vuln" : "vulns"} · ${severityLabel(maxSeverity as Severity)}`;
}

export function supportLabel(support: Pick<SupportStatus, "eol" | "isEol"> | null): string {
  if (support === null) {
    return "";
  }

  const date = typeof support.eol === "string";
  if (support.isEol) {
    return date ? `sin soporte desde ${support.eol}` : "sin soporte";
  }
  return date ? `soporte hasta ${support.eol}` : "con soporte";
}

export function groupByStatus(dependencies: DependencyEntry[]): Array<{ status: DependencyStatus; items: DependencyEntry[] }> {
  return STATUS_ORDER.map((status) => ({
    status,
    items: dependencies.filter((dependency) => dependency.status === status).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.items.length > 0);
}

// Ruta del manifiesto vista desde la raiz del stack ("../package.json" si esta arriba).
export function manifestLabel(manifest: string, root: string): string {
  const from = root.split("/").filter(Boolean);
  const to = manifest.split("/").filter(Boolean);
  const firstDifferent = from.findIndex((segment, index) => segment !== to[index]);
  const common = firstDifferent === -1 ? from.length : firstDifferent;

  return [...from.slice(common).map(() => ".."), ...to.slice(common)].join("/");
}

const DAY_MS = 86_400_000;

export function ageLabel(publishedAt: string | null, now: Date): string {
  if (publishedAt === null) {
    return "";
  }

  const days = Math.floor((now.getTime() - Date.parse(publishedAt)) / DAY_MS);
  if (days < 1) {
    return "hoy";
  }
  if (days < 30) {
    return plural(days, "dia", "dias");
  }
  if (days < 365) {
    return plural(Math.floor(days / 30), "mes", "meses");
  }
  return plural(Math.floor(days / 365), "año", "años");
}

function plural(count: number, one: string, many: string): string {
  return `hace ${count} ${count === 1 ? one : many}`;
}

const VERSION_GAPS = new Set<DependencyStatus>(["patch", "minor", "major"]);

// Siguiente paso concreto para el paquete: sin datos, vulnerable y despues de lo mas bloqueante a lo
// mas simple.
export function upgradeHint(dependency: DependencyEntry): string {
  if (dependency.lookupError !== null && dependency.status === "unknown") {
    return `Sin datos del registro: ${dependency.lookupError}`;
  }

  const next = blockingHint(dependency) ?? updateHint(dependency);
  return dependency.security.vulnerabilities.length === 0 ? next : securityHint(dependency, next);
}

function securityHint(dependency: DependencyEntry, next: string): string {
  const prefix = `Vulnerable (${severityLabel(dependency.security.maxSeverity as Severity)})`;

  if (dependency.security.recommendedAffected) {
    return `${prefix}: ninguna version compatible corrige todo`;
  }
  return dependency.recommended ? `${prefix}: actualizar a ${dependency.recommended}` : `${prefix}: ${next}`;
}

// Lo que impide actualizar sin mas: abandonado o sin version compatible con el runtime.
function blockingHint(dependency: DependencyEntry): string | null {
  if (dependency.status === "abandoned") {
    return dependency.replacement ? `Abandonado: reemplazar por ${dependency.replacement}` : "Abandonado: buscar reemplazo";
  }
  if (dependency.recommended === null && dependency.limitedByRuntime) {
    return "Ninguna version vigente funciona con el runtime elegido: requiere uno mas nuevo";
  }
  return null;
}

function updateHint(dependency: DependencyEntry): string {
  const { recommended } = dependency;

  if (dependency.status === "deprecated") {
    return `Deprecated: ${dependency.deprecation}${recommended ? ` · ir a ${recommended}` : ""}`;
  }
  if (dependency.limitedByRuntime) {
    return `Actualizar a ${recommended} (la ${dependency.latest} requiere un runtime mas nuevo)`;
  }
  return VERSION_GAPS.has(dependency.status) ? `Actualizar a ${recommended}` : "Al dia";
}

export function versionText(dependency: DependencyEntry): string {
  if (dependency.current === null) {
    return "—";
  }
  return dependency.recommended === null || dependency.recommended === dependency.current
    ? dependency.current
    : `${dependency.current} → ${dependency.recommended}`;
}

// Ultima version conocida de cada linea (para elegir un runtime sin teclearlo).
export const RUNTIME_LINES: Record<RuntimeKind, string[]> = {
  php: ["5.6.40", "7.0.33", "7.1.33", "7.2.34", "7.3.33", "7.4.33", "8.0.30", "8.1.33", "8.2.29", "8.3.26", "8.4.13"],
  node: ["12.22.12", "14.21.3", "16.20.2", "18.20.8", "20.19.5", "22.20.0", "24.9.0"],
  npm: ["6.14.18", "7.24.2", "8.19.4", "9.9.4", "10.9.3", "11.6.1"],
};

const KIND_LABELS: Record<RuntimeKind, string> = { php: "PHP", node: "Node", npm: "npm" };

export function runtimeKindLabel(kind: RuntimeKind): string {
  return KIND_LABELS[kind];
}

const MAX_CYCLE_OPTIONS = 12;

// La detectada y despues los ciclos publicados (endoflife.date) o, si no hay, las lineas fijas.
export function runtimeOptions(runtime: SelectedRuntime): Array<{ value: string; label: string }> {
  const detected = runtime.version === null ? [] : [{ value: runtime.version, label: `${runtime.version} (detectado: ${runtime.source})` }];
  const others = runtime.cycles.length > 0 ? cycleOptions(runtime) : lineOptions(runtime);

  return [...detected, ...others];
}

function cycleOptions(runtime: SelectedRuntime): Array<{ value: string; label: string }> {
  return runtime.cycles
    .filter((cycle) => cycle.latest !== null && cycle.latest !== runtime.version)
    .slice(0, MAX_CYCLE_OPTIONS)
    .map((cycle) => ({ value: cycle.latest as string, label: `${KIND_LABELS[runtime.kind]} ${cycle.cycle} (${cycle.latest}) · ${supportLabel(cycle)}` }));
}

function lineOptions(runtime: SelectedRuntime): Array<{ value: string; label: string }> {
  return RUNTIME_LINES[runtime.kind]
    .filter((version) => version !== runtime.version)
    .map((version) => ({ value: version, label: `${KIND_LABELS[runtime.kind]} ${lineOf(runtime.kind, version)} (${version})` }));
}

function lineOf(kind: RuntimeKind, version: string): string {
  const [major, minor] = version.split(".");
  return kind === "php" ? `${major}.${minor}` : major;
}

export function upToDatePercent(summary: DependencySummaryData): number {
  return summary.total === 0 ? 100 : Math.round((summary.byStatus.up_to_date / summary.total) * 100);
}
