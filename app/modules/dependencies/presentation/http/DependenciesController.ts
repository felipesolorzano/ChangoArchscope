import type { NextFunction, Request, Response } from "express";

import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { AdvisoryDatabase } from "../../application/contracts/AdvisoryDatabase.js";
import type { LookupCache } from "../../application/contracts/LookupCache.js";
import type { PackageInfoCache } from "../../application/contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../../application/contracts/PackageRegistry.js";
import type { RuntimeProbe } from "../../application/contracts/RuntimeProbe.js";
import type { SupportCalendar } from "../../application/contracts/SupportCalendar.js";
import { buildDependencyReport } from "../../application/use-cases/buildDependencyReport.js";
import { detectDependencies } from "../../application/use-cases/detectDependencies.js";
import { resolveCachedLookups } from "../../application/use-cases/resolveCachedLookups.js";
import { lookupKey, resolvePackageInfos, splitKey } from "../../application/use-cases/resolvePackageInfos.js";
import { runtimeProduct, supportProductFor } from "../../domain/services/supportProducts.js";
import type { DependencyInventory, RuntimeKind } from "../../domain/value-objects/Dependency.js";
import type { Advisory, SupportCycle } from "../../domain/value-objects/Security.js";

export type DependenciesControllerDeps = {
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

const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;
const RUNTIME_KINDS: RuntimeKind[] = ["php", "node", "npm"];

// Reporte de dependencias del stack: detecta en cada llamada, consulta registros, OSV y endoflife.date
// (con cache de 24 h, refresh=1 la salta) y clasifica con el runtime pedido por query o el detectado.
export class DependenciesController {
  constructor(private readonly deps: DependenciesControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = request.query.target === "react" ? "react" : "laravel";
      const stack = this.deps.getConfig()[target];
      const now = this.deps.now();
      const inventory = detectDependencies({ target, root: stack.modulesPath, ignoredPaths: stack.ignoredPaths, reader: this.deps.reader, probe: this.deps.probe });
      const cachePolicy = { now, ttlMs: TTL_MS, refresh: request.query.refresh === "1", concurrency: CONCURRENCY };
      const [lookups, advisories, calendars] = await Promise.all([
        resolvePackageInfos({ dependencies: inventory.dependencies, registry: this.deps.registry, cache: this.deps.cache, ...cachePolicy }),
        resolveCachedLookups({ keys: inventory.dependencies.map(({ ecosystem, name }) => lookupKey(ecosystem, name)), fetch: (key) => this.deps.advisories.fetch(...splitKey(key)), cache: this.deps.advisoryCache, ...cachePolicy }),
        resolveCachedLookups({ keys: supportProducts(inventory), fetch: (product) => this.deps.calendar.fetch(product), cache: this.deps.calendarCache, ...cachePolicy }),
      ]);

      response.status(200).json(
        buildDependencyReport({ inventory, lookups, advisories, calendars, requested: requestedRuntimes(request.query), generatedAt: now.toISOString(), today: now.toISOString() }),
      );
    } catch (error) {
      next(error);
    }
  };
}

function requestedRuntimes(query: Request["query"]): Partial<Record<RuntimeKind, string>> {
  return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind] as string]));
}

// Productos de endoflife.date a consultar: los de los runtimes y los de los paquetes reconocidos.
function supportProducts(inventory: DependencyInventory): string[] {
  return [
    ...inventory.runtimes.map((runtime) => runtimeProduct(runtime.kind)),
    ...inventory.dependencies.map((dependency) => supportProductFor(dependency.ecosystem, dependency.name)),
  ].filter((product): product is string => product !== null);
}
