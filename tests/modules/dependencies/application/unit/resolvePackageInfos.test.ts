import { describe, expect, it, vi } from "vitest";

import type { PackageInfoCache } from "../../../../../app/modules/dependencies/application/contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../../../../../app/modules/dependencies/application/contracts/PackageRegistry.js";
import { resolvePackageInfos } from "../../../../../app/modules/dependencies/application/use-cases/resolvePackageInfos.js";
import type { DeclaredDependency, Ecosystem, PackageInfo } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

const dep = (name: string, ecosystem: Ecosystem = "npm"): DeclaredDependency => ({ ecosystem, name, constraint: "^1.0.0", installed: null, dev: false, manifest: "/p" });
const infoOf = (name: string, ecosystem: Ecosystem = "npm"): PackageInfo => ({ ecosystem, name, releases: [], abandoned: null });

function memoryCache(rows: Record<string, { info: PackageInfo | null; fetchedAt: string }> = {}): PackageInfoCache & { rows: typeof rows } {
  return {
    rows,
    get: (ecosystem, name) => rows[`${ecosystem}:${name}`] ?? null,
    set: (ecosystem, name, info, fetchedAt) => {
      rows[`${ecosystem}:${name}`] = { info, fetchedAt };
    },
  };
}

const base = { now: NOW, ttlMs: 24 * HOUR, refresh: false, concurrency: 8 };

describe("resolvePackageInfos", () => {
  it("consulta cada paquete distinto una vez y guarda en cache con la fecha de ahora", async () => {
    const registry: PackageRegistry = { fetch: vi.fn(async (ecosystem, name) => infoOf(name, ecosystem)) };
    const cache = memoryCache();

    const lookups = await resolvePackageInfos({ ...base, dependencies: [dep("react"), dep("react"), dep("a/b", "composer")], registry, cache });

    expect(registry.fetch).toHaveBeenCalledTimes(2);
    expect(lookups.get("npm:react")).toEqual({ info: infoOf("react"), fetchedAt: NOW.toISOString(), error: null, stale: false });
    expect(lookups.get("composer:a/b")?.info).toEqual(infoOf("a/b", "composer"));
    expect(cache.rows["npm:react"]).toEqual({ info: infoOf("react"), fetchedAt: NOW.toISOString() });
  });

  it("usa la cache fresca sin consultar; la vencida (o con refresh) se vuelve a consultar", async () => {
    const fresh = new Date(NOW.getTime() - (24 * HOUR - 1)).toISOString();
    const expired = new Date(NOW.getTime() - 24 * HOUR).toISOString();
    const registry: PackageRegistry = { fetch: vi.fn(async (ecosystem, name) => infoOf(`${name}-new`, ecosystem)) };

    const lookups = await resolvePackageInfos({
      ...base,
      dependencies: [dep("fresh"), dep("old")],
      registry,
      cache: memoryCache({ "npm:fresh": { info: infoOf("fresh"), fetchedAt: fresh }, "npm:old": { info: infoOf("old"), fetchedAt: expired } }),
    });

    expect(registry.fetch).toHaveBeenCalledTimes(1);
    expect(registry.fetch).toHaveBeenCalledWith("npm", "old");
    expect(lookups.get("npm:fresh")).toEqual({ info: infoOf("fresh"), fetchedAt: fresh, error: null, stale: false });
    expect(lookups.get("npm:old")?.info?.name).toBe("old-new");

    const refreshed = await resolvePackageInfos({
      ...base,
      refresh: true,
      dependencies: [dep("fresh")],
      registry,
      cache: memoryCache({ "npm:fresh": { info: infoOf("fresh"), fetchedAt: fresh } }),
    });
    expect(refreshed.get("npm:fresh")?.info?.name).toBe("fresh-new");
  });

  it("una falla usa la cache vieja marcada stale, o queda sin info; las demas siguen", async () => {
    const registry: PackageRegistry = {
      fetch: vi.fn(async (_ecosystem, name) => {
        if (name !== "ok") {
          throw new Error(`timeout ${name}`);
        }
        return infoOf("ok");
      }),
    };
    const old = "2026-09-01T00:00:00.000Z";

    const lookups = await resolvePackageInfos({
      ...base,
      dependencies: [dep("cached"), dep("missing"), dep("ok")],
      registry,
      cache: memoryCache({ "npm:cached": { info: infoOf("cached"), fetchedAt: old } }),
    });

    expect(lookups.get("npm:cached")).toEqual({ info: infoOf("cached"), fetchedAt: old, error: "timeout cached", stale: true });
    expect(lookups.get("npm:missing")).toEqual({ info: null, fetchedAt: null, error: "timeout missing", stale: false });
    expect(lookups.get("npm:ok")?.error).toBeNull();
  });

  it("guarda tambien los paquetes que no existen (info null)", async () => {
    const cache = memoryCache();

    const lookups = await resolvePackageInfos({ ...base, dependencies: [dep("ghost")], registry: { fetch: async () => null }, cache });

    expect(lookups.get("npm:ghost")).toEqual({ info: null, fetchedAt: NOW.toISOString(), error: null, stale: false });
    expect(cache.rows["npm:ghost"]).toEqual({ info: null, fetchedAt: NOW.toISOString() });
  });

  it("nunca hay mas consultas simultaneas que concurrency", async () => {
    let active = 0;
    let peak = 0;
    const registry: PackageRegistry = {
      fetch: async (ecosystem, name) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return infoOf(name, ecosystem);
      },
    };

    const lookups = await resolvePackageInfos({ ...base, concurrency: 3, dependencies: ["a", "b", "c", "d", "e", "f", "g"].map((name) => dep(name)), registry, cache: memoryCache() });

    expect(peak).toBe(3);
    expect(lookups.size).toBe(7);
  });
});
