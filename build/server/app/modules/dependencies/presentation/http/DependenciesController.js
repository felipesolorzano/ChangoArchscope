import { buildDependencyReport } from "../../application/use-cases/buildDependencyReport.js";
import { detectDependencies } from "../../application/use-cases/detectDependencies.js";
import { resolvePackageInfos } from "../../application/use-cases/resolvePackageInfos.js";
const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 8;
const RUNTIME_KINDS = ["php", "node", "npm"];
// Reporte de dependencias del stack: detecta en cada llamada, consulta registros (con cache de 24 h,
// refresh=1 la salta) y clasifica con el runtime pedido por query o el detectado.
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
        }
        catch (error) {
            next(error);
        }
    };
}
function requestedRuntimes(query) {
    return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind]]));
}
