import type { LookupCache } from "../contracts/LookupCache.js";

export type Lookup<T> = { value: T | null; fetchedAt: string | null; error: string | null; stale: boolean };

export type ResolveCachedLookupsInput<T> = {
  keys: string[];
  fetch: (key: string) => Promise<T>;
  cache: LookupCache<T>;
  now: Date;
  ttlMs: number;
  refresh: boolean;
  concurrency: number;
};

// Una consulta por llave distinta: cache fresca si la hay; si no, consulta (con limite de
// concurrencia). Una falla cae a la cache vieja (stale) o queda sin valor, sin frenar las demas.
export async function resolveCachedLookups<T>(input: ResolveCachedLookupsInput<T>): Promise<Map<string, Lookup<T>>> {
  const keys = [...new Set(input.keys)];
  const lookups = new Map<string, Lookup<T>>();
  const pending = [...keys];

  const worker = async () => {
    for (let key = pending.shift(); key !== undefined; key = pending.shift()) {
      lookups.set(key, await lookup(key, input));
    }
  };

  await Promise.all(Array.from({ length: input.concurrency }, worker));

  return new Map(keys.map((key) => [key, lookups.get(key) as Lookup<T>]));
}

async function lookup<T>(key: string, { fetch, cache, now, ttlMs, refresh }: ResolveCachedLookupsInput<T>): Promise<Lookup<T>> {
  const cached = cache.get(key);

  if (cached && !refresh && now.getTime() - Date.parse(cached.fetchedAt) < ttlMs) {
    return { value: cached.value, fetchedAt: cached.fetchedAt, error: null, stale: false };
  }

  try {
    const value = await fetch(key);
    const fetchedAt = now.toISOString();
    cache.set(key, value, fetchedAt);
    return { value, fetchedAt, error: null, stale: false };
  } catch (error) {
    const message = (error as Error).message;
    return cached
      ? { value: cached.value, fetchedAt: cached.fetchedAt, error: message, stale: true }
      : { value: null, fetchedAt: null, error: message, stale: false };
  }
}
