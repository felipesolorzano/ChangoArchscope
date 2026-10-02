import { resolveCachedLookups } from "./resolveCachedLookups.js";
export function lookupKey(ecosystem, name) {
    return `${ecosystem}:${name}`;
}
export function splitKey(key) {
    const separator = key.indexOf(":");
    return [key.slice(0, separator), key.slice(separator + 1)];
}
// Info del registro por paquete distinto, con las reglas de cache de resolveCachedLookups.
export async function resolvePackageInfos(input) {
    const lookups = await resolveCachedLookups({
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
