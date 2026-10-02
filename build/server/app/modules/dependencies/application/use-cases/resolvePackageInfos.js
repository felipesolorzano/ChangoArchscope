export function lookupKey(ecosystem, name) {
    return `${ecosystem}:${name}`;
}
// Info del registro por paquete distinto: cache fresca si la hay; si no, consulta (con limite de
// concurrencia). Una falla cae a la cache vieja (stale) o queda sin info, sin frenar las demas.
export async function resolvePackageInfos(input) {
    const packages = new Map(input.dependencies.map((dependency) => [lookupKey(dependency.ecosystem, dependency.name), dependency]));
    const lookups = new Map();
    const pending = [...packages.entries()];
    const worker = async () => {
        for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
            const [key, dependency] = next;
            lookups.set(key, await lookup(dependency.ecosystem, dependency.name, input));
        }
    };
    await Promise.all(Array.from({ length: input.concurrency }, worker));
    return new Map([...packages.keys()].map((key) => [key, lookups.get(key)]));
}
async function lookup(ecosystem, name, { registry, cache, now, ttlMs, refresh }) {
    const cached = cache.get(ecosystem, name);
    if (cached && !refresh && now.getTime() - Date.parse(cached.fetchedAt) < ttlMs) {
        return { info: cached.info, fetchedAt: cached.fetchedAt, error: null, stale: false };
    }
    try {
        const info = await registry.fetch(ecosystem, name);
        const fetchedAt = now.toISOString();
        cache.set(ecosystem, name, info, fetchedAt);
        return { info, fetchedAt, error: null, stale: false };
    }
    catch (error) {
        const message = error.message;
        return cached
            ? { info: cached.info, fetchedAt: cached.fetchedAt, error: message, stale: true }
            : { info: null, fetchedAt: null, error: message, stale: false };
    }
}
