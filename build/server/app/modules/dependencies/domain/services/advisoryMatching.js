import semver from "semver";
import { normalizeVersion } from "./versioning.js";
const SEVERITY_RANK = { critical: 0, high: 1, moderate: 2, low: 3, unknown: 4 };
export function isAffected(version, advisory) {
    const normalized = normalizeVersion(version);
    if (normalized === null) {
        return false;
    }
    return advisory.versions.includes(normalized) || advisory.ranges.some((range) => inRange(normalized, range));
}
function inRange(version, range) {
    if (semver.lt(version, range.introduced)) {
        return false;
    }
    if (range.fixed !== null) {
        return semver.lt(version, range.fixed);
    }
    return range.lastAffected === null || semver.lte(version, range.lastAffected);
}
// Vulnerabilidades de la version actual (las mas graves primero) y si la recomendada sigue afectada.
export function assessSecurity(current, recommended, advisories) {
    const vulnerabilities = current === null ? [] : advisories.filter((advisory) => isAffected(current, advisory)).map((advisory) => toVulnerability(current, advisory));
    vulnerabilities.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id));
    return {
        vulnerabilities,
        maxSeverity: vulnerabilities[0]?.severity ?? null,
        recommendedAffected: recommended !== null && advisories.some((advisory) => isAffected(recommended, advisory)),
    };
}
function toVulnerability(current, advisory) {
    const fixes = advisory.ranges
        .map((range) => range.fixed)
        .filter((fixed) => fixed !== null && semver.gt(fixed, current))
        .sort(semver.compare);
    return {
        id: advisory.id,
        cve: advisory.aliases.find((alias) => alias.startsWith("CVE-")) ?? null,
        summary: advisory.summary,
        severity: advisory.severity,
        fixedIn: fixes[0] ?? null,
    };
}
