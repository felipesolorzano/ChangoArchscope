import type { NextFunction, Request, Response } from "express";

import type { ArchitectureConfig } from "../../../architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PackageInfoCache } from "../../application/contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../../application/contracts/PackageRegistry.js";
import type { RuntimeProbe } from "../../application/contracts/RuntimeProbe.js";
import { buildDependencyReport } from "../../application/use-cases/buildDependencyReport.js";
import { detectDependencies } from "../../application/use-cases/detectDependencies.js";
import { resolvePackageInfos } from "../../application/use-cases/resolvePackageInfos.js";
import type { RuntimeKind } from "../../domain/value-objects/Dependency.js";

export type DependenciesControllerDeps = {
  getConfig: () => ArchitectureConfig;
  reader: SourceTreeReader;
  probe: RuntimeProbe;
  registry: PackageRegistry;
  cache: PackageInfoCache;
  now: () => Date;
};

const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;
const RUNTIME_KINDS: RuntimeKind[] = ["php", "node", "npm"];

// Reporte de dependencias del stack: detecta en cada llamada, consulta registros (con cache de 24 h,
// refresh=1 la salta) y clasifica con el runtime pedido por query o el detectado.
export class DependenciesController {
  constructor(private readonly deps: DependenciesControllerDeps) {}

  show = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const target = request.query.target === "react" ? "react" : "laravel";
      const stack = this.deps.getConfig()[target];
      const now = this.deps.now();
      const inventory = detectDependencies({ target, root: stack.modulesPath, ignoredPaths: stack.ignoredPaths, reader: this.deps.reader, probe: this.deps.probe });
      const lookups = await resolvePackageInfos({
        dependencies: inventory.dependencies,
        registry: this.deps.registry,
        cache: this.deps.cache,
        now,
        ttlMs: TTL_MS,
        refresh: request.query.refresh === "1",
        concurrency: CONCURRENCY,
      });

      response.status(200).json(buildDependencyReport({ inventory, lookups, requested: requestedRuntimes(request.query), generatedAt: now.toISOString() }));
    } catch (error) {
      next(error);
    }
  };
}

function requestedRuntimes(query: Request["query"]): Partial<Record<RuntimeKind, string>> {
  return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind] as string]));
}
