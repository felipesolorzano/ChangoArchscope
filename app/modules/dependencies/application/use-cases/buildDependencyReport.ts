import { classifyDependency } from "../../domain/services/classifyDependency.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import type {
  DependencyInventory,
  DependencyReport,
  DependencyStatus,
  DetectedRuntime,
  RuntimeKind,
  RuntimeSelection,
} from "../../domain/value-objects/Dependency.js";
import { lookupKey, type PackageLookup } from "./resolvePackageInfos.js";

export type SelectedRuntime = DetectedRuntime & { selected: string | null };

export type DependencyReportEntry = DependencyReport & { fetchedAt: string | null; lookupError: string | null; stale: boolean };

export type DependencyReportResult = {
  generatedAt: string;
  root: string;
  manifests: string[];
  skipped: DependencyInventory["skipped"];
  runtimes: SelectedRuntime[];
  dependencies: DependencyReportEntry[];
  summary: { total: number; byStatus: Record<DependencyStatus, number>; limitedByRuntime: number; lookupErrors: number };
};

export type BuildDependencyReportInput = {
  inventory: DependencyInventory;
  lookups: Map<string, PackageLookup>;
  requested: Partial<Record<RuntimeKind, string>>;
  generatedAt: string;
};

const STATUSES: DependencyStatus[] = ["up_to_date", "patch", "minor", "major", "deprecated", "abandoned", "unknown"];
const NOT_FOUND = "no encontrado en el registro";

// Reporte clasificado con el runtime elegido (o el detectado si no se pidio uno valido).
export function buildDependencyReport({ inventory, lookups, requested, generatedAt }: BuildDependencyReportInput): DependencyReportResult {
  const runtimes = inventory.runtimes.map((runtime) => ({ ...runtime, selected: selectedVersion(requested[runtime.kind]) ?? runtime.version }));
  const selection: RuntimeSelection = Object.fromEntries(
    runtimes.filter((runtime) => runtime.selected !== null).map((runtime) => [runtime.kind, runtime.selected]),
  );

  const dependencies = inventory.dependencies.map((dependency): DependencyReportEntry => {
    const lookup = lookups.get(lookupKey(dependency.ecosystem, dependency.name)) ?? { info: null, fetchedAt: null, error: null, stale: false };
    return {
      ...classifyDependency(dependency, lookup.info, selection),
      fetchedAt: lookup.fetchedAt,
      lookupError: lookup.error ?? (lookup.info === null ? NOT_FOUND : null),
      stale: lookup.stale,
    };
  });

  return {
    generatedAt,
    root: inventory.root,
    manifests: inventory.manifests,
    skipped: inventory.skipped,
    runtimes,
    dependencies,
    summary: {
      total: dependencies.length,
      byStatus: Object.fromEntries(STATUSES.map((status) => [status, dependencies.filter((entry) => entry.status === status).length])) as Record<DependencyStatus, number>,
      limitedByRuntime: dependencies.filter((entry) => entry.limitedByRuntime).length,
      lookupErrors: dependencies.filter((entry) => entry.lookupError !== null).length,
    },
  };
}

function selectedVersion(raw: string | undefined): string | null {
  return raw === undefined ? null : normalizeVersion(raw);
}
