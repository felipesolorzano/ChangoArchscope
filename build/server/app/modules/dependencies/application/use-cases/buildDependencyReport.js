import { classifyDependency } from "../../domain/services/classifyDependency.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import { lookupKey } from "./resolvePackageInfos.js";
const STATUSES = ["up_to_date", "patch", "minor", "major", "deprecated", "abandoned", "unknown"];
const NOT_FOUND = "no encontrado en el registro";
// Reporte clasificado con el runtime elegido (o el detectado si no se pidio uno valido).
export function buildDependencyReport({ inventory, lookups, requested, generatedAt }) {
    const runtimes = inventory.runtimes.map((runtime) => ({ ...runtime, selected: selectedVersion(requested[runtime.kind]) ?? runtime.version }));
    const selection = Object.fromEntries(runtimes.filter((runtime) => runtime.selected !== null).map((runtime) => [runtime.kind, runtime.selected]));
    const dependencies = inventory.dependencies.map((dependency) => {
        const lookup = lookups.get(lookupKey(dependency.ecosystem, dependency.name)) ?? { info: null, fetchedAt: null, error: null, stale: false };
        return {
            ...classifyDependency(dependency, lookup.info, selection),
            fetchedAt: lookup.fetchedAt,
            lookupError: lookup.error ?? (lookup.info === null ? NOT_FOUND : null),
            stale: lookup.stale,
        };
    });
    return {
        generatedAt,
        root: inventory.root,
        manifests: inventory.manifests,
        skipped: inventory.skipped,
        runtimes,
        dependencies,
        summary: {
            total: dependencies.length,
            byStatus: Object.fromEntries(STATUSES.map((status) => [status, dependencies.filter((entry) => entry.status === status).length])),
            limitedByRuntime: dependencies.filter((entry) => entry.limitedByRuntime).length,
            lookupErrors: dependencies.filter((entry) => entry.lookupError !== null).length,
        },
    };
}
function selectedVersion(raw) {
    return raw === undefined ? null : normalizeVersion(raw);
}
