import { describe, expect, it, vi } from "vitest";

import type { LookupCache } from "../../../../../app/modules/dependencies/application/contracts/LookupCache.js";
import { resolveCachedLookups } from "../../../../../app/modules/dependencies/application/use-cases/resolveCachedLookups.js";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const HOUR = 3_600_000;

function memoryCache<T>(rows: Record<string, { value: T; fetchedAt: string }> = {}): LookupCache<T> & { rows: typeof rows } {
  return { rows, get: (key) => rows[key] ?? null, set: (key, value, fetchedAt) => void (rows[key] = { value, fetchedAt }) };
}

const base = { now: NOW, ttlMs: 24 * HOUR, refresh: false, concurrency: 4 };

describe("resolveCachedLookups offline", () => {
  it("no consulta: usa la cache aunque este vencida (stale) y lo que no esta queda sin valor", async () => {
    const fetch = vi.fn(async () => "x");
    const old = "2026-01-01T00:00:00.000Z";
    const fresh = NOW.toISOString();

    const lookups = await resolveCachedLookups({
      ...base,
      offline: true,
      refresh: true,
      keys: ["old", "fresh", "none"],
      fetch,
      cache: memoryCache<string>({ old: { value: "viejo", fetchedAt: old }, fresh: { value: "nuevo", fetchedAt: fresh } }),
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(lookups.get("old")).toEqual({ value: "viejo", fetchedAt: old, error: null, stale: true });
    expect(lookups.get("fresh")).toEqual({ value: "nuevo", fetchedAt: fresh, error: null, stale: false });
    expect(lookups.get("none")).toEqual({ value: null, fetchedAt: null, error: "sin datos en cache", stale: false });
  });
});

describe("resolveCachedLookups", () => {
  it("consulta llaves distintas, guarda en cache y respeta la cache fresca", async () => {
    const fetch = vi.fn(async (key: string) => `v-${key}`);
    const cache = memoryCache<string>({ cached: { value: "old", fetchedAt: new Date(NOW.getTime() - HOUR).toISOString() } });

    const lookups = await resolveCachedLookups({ ...base, keys: ["a", "a", "cached"], fetch, cache });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...lookups.keys()]).toEqual(["a", "cached"]);
    expect(lookups.get("a")).toEqual({ value: "v-a", fetchedAt: NOW.toISOString(), error: null, stale: false });
    expect(lookups.get("cached")).toEqual({ value: "old", fetchedAt: new Date(NOW.getTime() - HOUR).toISOString(), error: null, stale: false });
    expect(cache.rows.a).toEqual({ value: "v-a", fetchedAt: NOW.toISOString() });
  });

  it("refresh vuelve a consultar; una falla cae a la cache vieja (stale) o queda sin valor", async () => {
    const fetch = vi.fn(async (key: string) => {
      if (key !== "ok") {
        throw new Error(`down ${key}`);
      }
      return "fresh";
    });
    const old = "2026-01-01T00:00:00.000Z";

    const lookups = await resolveCachedLookups({
      ...base,
      refresh: true,
      keys: ["ok", "cached", "none"],
      fetch,
      cache: memoryCache<string>({ ok: { value: "x", fetchedAt: NOW.toISOString() }, cached: { value: "old", fetchedAt: old } }),
    });

    expect(lookups.get("ok")?.value).toBe("fresh");
    expect(lookups.get("cached")).toEqual({ value: "old", fetchedAt: old, error: "down cached", stale: true });
    expect(lookups.get("none")).toEqual({ value: null, fetchedAt: null, error: "down none", stale: false });
  });
});
