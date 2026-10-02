import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { runtimeProduct, supportProductFor } from "../../domain/services/supportProducts.js";
import type { DependencyInventory, RuntimeKind } from "../../domain/value-objects/Dependency.js";
import type { Advisory, SupportCycle } from "../../domain/value-objects/Security.js";
import type { AdvisoryDatabase } from "../contracts/AdvisoryDatabase.js";
import type { LookupCache } from "../contracts/LookupCache.js";
import type { PackageInfoCache } from "../contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../contracts/PackageRegistry.js";
import type { RuntimeProbe } from "../contracts/RuntimeProbe.js";
import type { SupportCalendar } from "../contracts/SupportCalendar.js";
import { buildDependencyReport, type DependencyReportResult } from "./buildDependencyReport.js";
import { detectDependencies } from "./detectDependencies.js";
import { measureUsage } from "./measureUsage.js";
import { resolveCachedLookups } from "./resolveCachedLookups.js";
import { lookupKey, resolvePackageInfos, splitKey } from "./resolvePackageInfos.js";

export type DependencyReportDeps = {
  getConfig: () => ArchitectureConfig;
  reader: SourceTreeReader;
  probe: RuntimeProbe;
  registry: PackageRegistry;
  cache: PackageInfoCache;
  advisories: AdvisoryDatabase;
  advisoryCache: LookupCache<Advisory[]>;
  calendar: SupportCalendar;
  calendarCache: LookupCache<SupportCycle[] | null>;
  now: () => Date;
};

export type DependencyReportRequest = {
  target: "laravel" | "react";
  requested: Partial<Record<RuntimeKind, string>>;
  refresh: boolean;
  /** Sin red (lo usa el Plan): solo lo que ya esta en cache. */
  offline: boolean;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;

// Detecta en cada llamada, consulta registros, OSV y endoflife.date (cache de 24 h), mide el uso en el
// codigo y clasifica con el runtime pedido o el detectado.
export async function generateDependencyReport(deps: DependencyReportDeps, { target, requested, refresh, offline }: DependencyReportRequest): Promise<DependencyReportResult> {
  const stack = deps.getConfig()[target];
  const now = deps.now();
  const inventory = detectDependencies({ target, root: stack.modulesPath, ignoredPaths: stack.ignoredPaths, reader: deps.reader, probe: deps.probe });
  const policy = { now, ttlMs: TTL_MS, refresh, offline, concurrency: CONCURRENCY };
  const [lookups, advisories, calendars] = await Promise.all([
    resolvePackageInfos({ dependencies: inventory.dependencies, registry: deps.registry, cache: deps.cache, ...policy }),
    resolveCachedLookups({
      keys: inventory.dependencies.map(({ ecosystem, name }) => lookupKey(ecosystem, name)),
      fetch: (key) => deps.advisories.fetch(...splitKey(key)),
      cache: deps.advisoryCache,
      ...policy,
    }),
    resolveCachedLookups({ keys: supportProducts(inventory), fetch: (product) => deps.calendar.fetch(product), cache: deps.calendarCache, ...policy }),
  ]);
  const usage = measureUsage({ dependencies: inventory.dependencies, reader: deps.reader });

  return buildDependencyReport({ inventory, lookups, advisories, calendars, usage, requested, generatedAt: now.toISOString(), today: now.toISOString() });
}

// Productos de endoflife.date a consultar: los de los runtimes y los de los paquetes reconocidos.
function supportProducts(inventory: DependencyInventory): string[] {
  return [
    ...inventory.runtimes.map((runtime) => runtimeProduct(runtime.kind)),
    ...inventory.dependencies.map((dependency) => supportProductFor(dependency.ecosystem, dependency.name)),
  ].filter((product): product is string => product !== null);
}
