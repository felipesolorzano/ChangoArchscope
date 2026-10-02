import semver from "semver";
import { minVersionOf, normalizeVersion, satisfiesConstraint, versionGap } from "./versioning.js";
// Compara un paquete contra sus releases: a que version conviene ir con el runtime elegido.
export function classifyDependency(dependency, info, selection) {
    const current = dependency.installed ?? minVersionOf(dependency.constraint, dependency.ecosystem);
    const abandoned = info?.abandoned ?? null;
    const stable = stableReleases(info?.releases ?? []);
    const usable = stable.filter((release) => release.deprecated === null);
    const compatible = usable.filter((release) => fitsRuntime(release, selection, dependency.ecosystem));
    const latestRelease = stable.at(-1);
    const latest = latestRelease?.version ?? null;
    const bestUsable = usable.at(-1)?.version ?? null;
    const recommended = compatible.at(-1)?.version ?? null;
    const gap = current !== null && recommended !== null ? versionGap(current, recommended) : "none";
    const currentRelease = stable.find((release) => release.version === current);
    // Sin release actual publicada, el paquete entero deprecated (ninguna estable vigente) tambien cuenta.
    const deprecation = currentRelease ? currentRelease.deprecated : usable.length === 0 ? (latestRelease?.deprecated ?? null) : null;
    return {
        ...dependency,
        current,
        latest,
        recommended,
        gap,
        status: statusOf(abandoned, latest, deprecation, gap),
        deprecation,
        replacement: typeof abandoned === "string" ? abandoned : null,
        limitedByRuntime: bestUsable !== recommended,
        currentPublishedAt: currentRelease?.publishedAt ?? null,
        latestPublishedAt: latestRelease?.publishedAt ?? null,
    };
}
// Releases con version valida y sin prerelease, de menor a mayor.
function stableReleases(releases) {
    return releases
        .map((release) => ({ ...release, version: normalizeVersion(release.version) ?? "" }))
        .filter((release) => release.version !== "" && semver.prerelease(release.version) === null)
        .sort((a, b) => semver.compare(a.version, b.version));
}
function fitsRuntime(release, selection, ecosystem) {
    return Object.entries(release.requires).every(([kind, constraint]) => selection[kind] === undefined || satisfiesConstraint(selection[kind], constraint, ecosystem));
}
function statusOf(abandoned, latest, deprecation, gap) {
    if (latest === null) {
        return "unknown";
    }
    if (abandoned) {
        return "abandoned";
    }
    if (deprecation !== null) {
        return "deprecated";
    }
    return gap === "none" ? "up_to_date" : gap;
}
