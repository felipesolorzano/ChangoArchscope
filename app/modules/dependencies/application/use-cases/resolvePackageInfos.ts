import type { DeclaredDependency, Ecosystem, PackageInfo } from "../../domain/value-objects/Dependency.js";
import type { PackageInfoCache } from "../contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../contracts/PackageRegistry.js";

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
};

export function lookupKey(ecosystem: Ecosystem, name: string): string {
  return `${ecosystem}:${name}`;
}

// Info del registro por paquete distinto: cache fresca si la hay; si no, consulta (con limite de
// concurrencia). Una falla cae a la cache vieja (stale) o queda sin info, sin frenar las demas.
export async function resolvePackageInfos(input: ResolvePackageInfosInput): Promise<Map<string, PackageLookup>> {
  const packages = new Map(input.dependencies.map((dependency) => [lookupKey(dependency.ecosystem, dependency.name), dependency]));
  const lookups = new Map<string, PackageLookup>();
  const pending = [...packages.entries()];

  const worker = async () => {
    for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
      const [key, dependency] = next;
      lookups.set(key, await lookup(dependency.ecosystem, dependency.name, input));
    }
  };

  await Promise.all(Array.from({ length: input.concurrency }, worker));

  return new Map([...packages.keys()].map((key) => [key, lookups.get(key) as PackageLookup]));
}

async function lookup(ecosystem: Ecosystem, name: string, { registry, cache, now, ttlMs, refresh }: ResolvePackageInfosInput): Promise<PackageLookup> {
  const cached = cache.get(ecosystem, name);

  if (cached && !refresh && now.getTime() - Date.parse(cached.fetchedAt) < ttlMs) {
    return { info: cached.info, fetchedAt: cached.fetchedAt, error: null, stale: false };
  }

  try {
    const info = await registry.fetch(ecosystem, name);
    const fetchedAt = now.toISOString();
    cache.set(ecosystem, name, info, fetchedAt);
    return { info, fetchedAt, error: null, stale: false };
  } catch (error) {
    const message = (error as Error).message;
    return cached
      ? { info: cached.info, fetchedAt: cached.fetchedAt, error: message, stale: true }
      : { info: null, fetchedAt: null, error: message, stale: false };
  }
}
