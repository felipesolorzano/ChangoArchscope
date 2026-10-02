import { assessSecurity } from "../../domain/services/advisoryMatching.js";
import { classifyDependency } from "../../domain/services/classifyDependency.js";
import type { Usage } from "../../domain/services/packageUsage.js";
import { upgradeGroup } from "../../domain/services/upgradeGroups.js";
import { runtimeProduct, supportProductFor } from "../../domain/services/supportProducts.js";
import { isPast, supportStatus } from "../../domain/services/supportStatus.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import type {
  DeclaredDependency,
  DependencyInventory,
  DependencyReport,
  DependencyStatus,
  DetectedRuntime,
  RuntimeKind,
  RuntimeSelection,
} from "../../domain/value-objects/Dependency.js";
import type { Advisory, SecurityAssessment, Severity, SupportCycle, SupportStatus } from "../../domain/value-objects/Security.js";
import { usageKey } from "./measureUsage.js";
import type { Lookup } from "./resolveCachedLookups.js";
import { lookupKey, type PackageLookup } from "./resolvePackageInfos.js";

export type RuntimeCycle = { cycle: string; latest: string | null; eol: string | boolean; isEol: boolean };

export type SelectedRuntime = DetectedRuntime & { selected: string | null; support: SupportStatus | null; cycles: RuntimeCycle[] };

export type DependencyReportEntry = DependencyReport & {
  fetchedAt: string | null;
  lookupError: string | null;
  stale: boolean;
  security: SecurityAssessment;
  advisoryError: string | null;
  support: SupportStatus | null;
  usage: Usage | null;
  group: string | null;
};

export type DependencyReportResult = {
  generatedAt: string;
  root: string;
  manifests: string[];
  skipped: DependencyInventory["skipped"];
  runtimes: SelectedRuntime[];
  dependencies: DependencyReportEntry[];
  summary: {
    total: number;
    byStatus: Record<DependencyStatus, number>;
    limitedByRuntime: number;
    lookupErrors: number;
    vulnerable: number;
    bySeverity: Record<Severity, number>;
    endOfLife: number;
    unused: number;
    vendored: number;
  };
};

export type BuildDependencyReportInput = {
  inventory: DependencyInventory;
  lookups: Map<string, PackageLookup>;
  requested: Partial<Record<RuntimeKind, string>>;
  generatedAt: string;
  advisories: Map<string, Lookup<Advisory[]>>;
  calendars: Map<string, Lookup<SupportCycle[] | null>>;
  /** Fecha de hoy (YYYY-MM-DD) para decidir si un ciclo ya vencio. */
  today: string;
  usage: Map<string, Usage>;
};

const STATUSES: DependencyStatus[] = ["up_to_date", "patch", "minor", "major", "deprecated", "abandoned", "unknown"];
const SEVERITIES: Severity[] = ["critical", "high", "moderate", "low", "unknown"];
const NOT_FOUND = "no encontrado en el registro";
const NO_LOOKUP = { info: null, fetchedAt: null, error: null, stale: false };

// Reporte clasificado con el runtime elegido (o el detectado si no se pidio uno valido), con sus
// vulnerabilidades y el soporte de runtimes y frameworks reconocidos.
export function buildDependencyReport(input: BuildDependencyReportInput): DependencyReportResult {
  const runtimes = input.inventory.runtimes.map((runtime) => selectedRuntime(runtime, input));
  const selection: RuntimeSelection = Object.fromEntries(
    runtimes.filter((runtime) => runtime.selected !== null).map((runtime) => [runtime.kind, runtime.selected]),
  );
  const dependencies = input.inventory.dependencies.map((dependency) => reportEntry(dependency, selection, input));

  return {
    generatedAt: input.generatedAt,
    root: input.inventory.root,
    manifests: input.inventory.manifests,
    skipped: input.inventory.skipped,
    runtimes,
    dependencies,
    summary: summarize(dependencies),
  };
}

function selectedRuntime(runtime: DetectedRuntime, { requested, calendars, today }: BuildDependencyReportInput): SelectedRuntime {
  const selected = selectedVersion(requested[runtime.kind]) ?? runtime.version;
  const product = runtimeProduct(runtime.kind);
  const cycles = cyclesOf(product, calendars);

  return {
    ...runtime,
    selected,
    // Stryker disable next-line ConditionalExpression: sin producto no hay ciclos y supportStatus da null, mutante equivalente.
    support: product === null ? null : supportStatus(product, selected, cycles, today),
    cycles: cycles.map((cycle) => ({ cycle: cycle.cycle, latest: cycle.latest, eol: cycle.eol, isEol: isPast(cycle.eol, today) })),
  };
}

function reportEntry(dependency: DeclaredDependency, selection: RuntimeSelection, { lookups, advisories, calendars, today, usage }: BuildDependencyReportInput): DependencyReportEntry {
  const key = lookupKey(dependency.ecosystem, dependency.name);
  const lookup = lookups.get(key) ?? NO_LOOKUP;
  const report = classifyDependency(dependency, lookup.info, selection);
  const advisory = advisories.get(key);
  const product = supportProductFor(dependency.ecosystem, dependency.name);

  return {
    ...report,
    fetchedAt: lookup.fetchedAt,
    lookupError: lookup.error ?? (lookup.info === null ? NOT_FOUND : null),
    stale: lookup.stale,
    security: assessSecurity(report.current, report.recommended, advisory?.value ?? []),
    advisoryError: advisory?.error ?? null,
    // Stryker disable next-line ConditionalExpression: sin producto no hay ciclos y supportStatus da null, mutante equivalente.
    support: product === null ? null : supportStatus(product, report.current, cyclesOf(product, calendars), today),
    usage: usage.get(usageKey(dependency)) ?? null,
    group: upgradeGroup(dependency.ecosystem, dependency.name),
  };
}

function cyclesOf(product: string | null, calendars: BuildDependencyReportInput["calendars"]): SupportCycle[] {
  // Stryker disable next-line ConditionalExpression: un producto null no esta en el mapa de calendarios, mutante equivalente.
  return (product === null ? null : calendars.get(product)?.value) ?? [];
}

function summarize(dependencies: DependencyReportEntry[]): DependencyReportResult["summary"] {
  const count = (predicate: (entry: DependencyReportEntry) => boolean) => dependencies.filter(predicate).length;

  return {
    total: dependencies.length,
    byStatus: Object.fromEntries(STATUSES.map((status) => [status, count((entry) => entry.status === status)])) as Record<DependencyStatus, number>,
    limitedByRuntime: count((entry) => entry.limitedByRuntime),
    lookupErrors: count((entry) => entry.lookupError !== null),
    vulnerable: count((entry) => entry.security.vulnerabilities.length > 0),
    bySeverity: Object.fromEntries(SEVERITIES.map((severity) => [severity, count((entry) => entry.security.maxSeverity === severity)])) as Record<Severity, number>,
    endOfLife: count((entry) => entry.support?.isEol === true),
    unused: count((entry) => entry.usage?.unused === true),
    vendored: count((entry) => entry.vendored !== undefined),
  };
}

function selectedVersion(raw: string | undefined): string | null {
  return raw === undefined ? null : normalizeVersion(raw);
}
