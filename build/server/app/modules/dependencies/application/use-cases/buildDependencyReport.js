import { assessSecurity } from "../../domain/services/advisoryMatching.js";
import { classifyDependency } from "../../domain/services/classifyDependency.js";
import { upgradeGroup } from "../../domain/services/upgradeGroups.js";
import { runtimeProduct, supportProductFor } from "../../domain/services/supportProducts.js";
import { isPast, supportStatus } from "../../domain/services/supportStatus.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import { usageKey } from "./measureUsage.js";
import { lookupKey } from "./resolvePackageInfos.js";
const STATUSES = ["up_to_date", "patch", "minor", "major", "deprecated", "abandoned", "unknown"];
const SEVERITIES = ["critical", "high", "moderate", "low", "unknown"];
const NOT_FOUND = "no encontrado en el registro";
const NO_LOOKUP = { info: null, fetchedAt: null, error: null, stale: false };
// Reporte clasificado con el runtime elegido (o el detectado si no se pidio uno valido), con sus
// vulnerabilidades y el soporte de runtimes y frameworks reconocidos.
export function buildDependencyReport(input) {
    const runtimes = input.inventory.runtimes.map((runtime) => selectedRuntime(runtime, input));
    const selection = Object.fromEntries(runtimes.filter((runtime) => runtime.selected !== null).map((runtime) => [runtime.kind, runtime.selected]));
    const dependencies = input.inventory.dependencies.map((dependency) => reportEntry(dependency, selection, input));
    return {
        generatedAt: input.generatedAt,
        root: input.inventory.root,
        manifests: input.inventory.manifests,
        skipped: input.inventory.skipped,
        runtimes,
        dependencies,
        summary: summarize(dependencies),
    };
}
function selectedRuntime(runtime, { requested, calendars, today }) {
    const selected = selectedVersion(requested[runtime.kind]) ?? runtime.version;
    const product = runtimeProduct(runtime.kind);
    const cycles = cyclesOf(product, calendars);
    return {
        ...runtime,
        selected,
        // Stryker disable next-line ConditionalExpression: sin producto no hay ciclos y supportStatus da null, mutante equivalente.
        support: product === null ? null : supportStatus(product, selected, cycles, today),
        cycles: cycles.map((cycle) => ({ cycle: cycle.cycle, latest: cycle.latest, eol: cycle.eol, isEol: isPast(cycle.eol, today) })),
    };
}
function reportEntry(dependency, selection, { lookups, advisories, calendars, today, usage }) {
    const key = lookupKey(dependency.ecosystem, dependency.name);
    const lookup = lookups.get(key) ?? NO_LOOKUP;
    const report = classifyDependency(dependency, lookup.info, selection);
    const advisory = advisories.get(key);
    const product = supportProductFor(dependency.ecosystem, dependency.name);
    return {
        ...report,
        fetchedAt: lookup.fetchedAt,
        lookupError: lookup.error ?? (lookup.info === null ? NOT_FOUND : null),
        stale: lookup.stale,
        security: assessSecurity(report.current, report.recommended, advisory?.value ?? []),
        advisoryError: advisory?.error ?? null,
        // Stryker disable next-line ConditionalExpression: sin producto no hay ciclos y supportStatus da null, mutante equivalente.
        support: product === null ? null : supportStatus(product, report.current, cyclesOf(product, calendars), today),
        usage: usage.get(usageKey(dependency)) ?? null,
        group: upgradeGroup(dependency.ecosystem, dependency.name),
    };
}
function cyclesOf(product, calendars) {
    // Stryker disable next-line ConditionalExpression: un producto null no esta en el mapa de calendarios, mutante equivalente.
    return (product === null ? null : calendars.get(product)?.value) ?? [];
}
function summarize(dependencies) {
    const count = (predicate) => dependencies.filter(predicate).length;
    return {
        total: dependencies.length,
        byStatus: Object.fromEntries(STATUSES.map((status) => [status, count((entry) => entry.status === status)])),
        limitedByRuntime: count((entry) => entry.limitedByRuntime),
        lookupErrors: count((entry) => entry.lookupError !== null),
        vulnerable: count((entry) => entry.security.vulnerabilities.length > 0),
        bySeverity: Object.fromEntries(SEVERITIES.map((severity) => [severity, count((entry) => entry.security.maxSeverity === severity)])),
        endOfLife: count((entry) => entry.support?.isEol === true),
        unused: count((entry) => entry.usage?.unused === true),
        vendored: count((entry) => entry.vendored !== undefined),
    };
}
function selectedVersion(raw) {
    return raw === undefined ? null : normalizeVersion(raw);
}
