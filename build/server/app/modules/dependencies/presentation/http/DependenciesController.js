import { buildDependencyReport } from "../../application/use-cases/buildDependencyReport.js";
import { detectDependencies } from "../../application/use-cases/detectDependencies.js";
import { resolveCachedLookups } from "../../application/use-cases/resolveCachedLookups.js";
import { lookupKey, resolvePackageInfos, splitKey } from "../../application/use-cases/resolvePackageInfos.js";
import { runtimeProduct, supportProductFor } from "../../domain/services/supportProducts.js";
const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;
const RUNTIME_KINDS = ["php", "node", "npm"];
// Reporte de dependencias del stack: detecta en cada llamada, consulta registros, OSV y endoflife.date
// (con cache de 24 h, refresh=1 la salta) y clasifica con el runtime pedido por query o el detectado.
export class DependenciesController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
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
            response.status(200).json(buildDependencyReport({ inventory, lookups, advisories, calendars, requested: requestedRuntimes(request.query), generatedAt: now.toISOString(), today: now.toISOString() }));
        }
        catch (error) {
            next(error);
        }
    };
}
function requestedRuntimes(query) {
    return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind]]));
}
// Productos de endoflife.date a consultar: los de los runtimes y los de los paquetes reconocidos.
function supportProducts(inventory) {
    return [
        ...inventory.runtimes.map((runtime) => runtimeProduct(runtime.kind)),
        ...inventory.dependencies.map((dependency) => supportProductFor(dependency.ecosystem, dependency.name)),
    ].filter((product) => product !== null);
}
