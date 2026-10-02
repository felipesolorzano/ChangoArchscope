import type { DeclaredDependency, Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";
import type { PackageInfoCache } from "../contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../contracts/PackageRegistry.js";
import { resolveCachedLookups } from "./resolveCachedLookups.js";

export type PackageLookup = {
  info: PackageInfo | null;
  fetchedAt: string | null;
  error: string | null;
  stale: boolean;
};

export type ResolvePackageInfosInput = {
  dependencies: DeclaredDependency[];
  registry: PackageRegistry;
  cache: PackageInfoCache;
  now: Date;
  ttlMs: number;
  refresh: boolean;
  concurrency: number;
  offline?: boolean;
};

export function lookupKey(ecosystem: Ecosystem, name: string): string {
  return `${ecosystem}:${name}`;
}

export function splitKey(key: string): [Ecosystem, string] {
  const separator = key.indexOf(":");
  return [key.slice(0, separator) as Ecosystem, key.slice(separator + 1)];
}

// Info del registro por paquete distinto, con las reglas de cache de resolveCachedLookups.
export async function resolvePackageInfos(input: ResolvePackageInfosInput): Promise<Map<string, PackageLookup>> {
  const lookups = await resolveCachedLookups<PackageInfo | null>({
    keys: input.dependencies.map((dependency) => lookupKey(dependency.ecosystem, dependency.name)),
    fetch: (key) => input.registry.fetch(...splitKey(key)),
    cache: {
      get: (key) => {
        const cached = input.cache.get(...splitKey(key));
        return cached && { value: cached.info, fetchedAt: cached.fetchedAt };
      },
      set: (key, value, fetchedAt) => input.cache.set(...splitKey(key), value, fetchedAt),
    },
    now: input.now,
    ttlMs: input.ttlMs,
    refresh: input.refresh,
    concurrency: input.concurrency,
    offline: input.offline,
  });

  return new Map([...lookups].map(([key, { value, ...rest }]) => [key, { info: value, ...rest }]));
}
