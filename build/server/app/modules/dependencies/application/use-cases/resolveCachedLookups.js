// Una consulta por llave distinta: cache fresca si la hay; si no, consulta (con limite de
// concurrencia). Una falla cae a la cache vieja (stale) o queda sin valor, sin frenar las demas.
export async function resolveCachedLookups(input) {
    const keys = [...new Set(input.keys)];
    const lookups = new Map();
    const pending = [...keys];
    const worker = async () => {
        for (let key = pending.shift(); key !== undefined; key = pending.shift()) {
            lookups.set(key, await lookup(key, input));
        }
    };
    await Promise.all(Array.from({ length: input.concurrency }, worker));
    return new Map(keys.map((key) => [key, lookups.get(key)]));
}
async function lookup(key, { fetch, cache, now, ttlMs, refresh }) {
    const cached = cache.get(key);
    if (cached && !refresh && now.getTime() - Date.parse(cached.fetchedAt) < ttlMs) {
        return { value: cached.value, fetchedAt: cached.fetchedAt, error: null, stale: false };
    }
    try {
        const value = await fetch(key);
        const fetchedAt = now.toISOString();
        cache.set(key, value, fetchedAt);
        return { value, fetchedAt, error: null, stale: false };
    }
    catch (error) {
        const message = error.message;
        return cached
            ? { value: cached.value, fetchedAt: cached.fetchedAt, error: message, stale: true }
            : { value: null, fetchedAt: null, error: message, stale: false };
    }
}
