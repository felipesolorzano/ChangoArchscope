import type {
  DependencyEntry,
  DependencyStatus,
  DependencySummaryData,
  RuntimeKind,
  SelectedRuntime,
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

export type DependencyFiltersState = { status: DependencyStatus | "all"; query: string; hideDev: boolean };

export function filterDependencies(dependencies: DependencyEntry[], { status, query, hideDev }: DependencyFiltersState): DependencyEntry[] {
  const needle = query.trim().toLowerCase();

  return dependencies.filter(
    (dependency) =>
      (status === "all" || dependency.status === status) &&
      dependency.name.toLowerCase().includes(needle) &&
      !(hideDev && dependency.dev),
  );
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

// Siguiente paso concreto para el paquete, de lo mas bloqueante a lo mas simple.
export function upgradeHint(dependency: DependencyEntry): string {
  return blockingHint(dependency) ?? updateHint(dependency);
}

// Lo que impide actualizar sin mas: sin datos, abandonado o sin version compatible con el runtime.
function blockingHint(dependency: DependencyEntry): string | null {
  if (dependency.lookupError !== null && dependency.status === "unknown") {
    return `Sin datos del registro: ${dependency.lookupError}`;
  }
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

export function runtimeOptions(runtime: SelectedRuntime): Array<{ value: string; label: string }> {
  const detected = runtime.version === null ? [] : [{ value: runtime.version, label: `${runtime.version} (detectado: ${runtime.source})` }];
  const lines = RUNTIME_LINES[runtime.kind]
    .filter((version) => version !== runtime.version)
    .map((version) => ({ value: version, label: `${KIND_LABELS[runtime.kind]} ${lineOf(runtime.kind, version)} (${version})` }));

  return [...detected, ...lines];
}

function lineOf(kind: RuntimeKind, version: string): string {
  const [major, minor] = version.split(".");
  return kind === "php" ? `${major}.${minor}` : major;
}

export function upToDatePercent(summary: DependencySummaryData): number {
  return summary.total === 0 ? 100 : Math.round((summary.byStatus.up_to_date / summary.total) * 100);
}
