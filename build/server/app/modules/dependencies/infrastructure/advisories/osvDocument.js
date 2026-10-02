import { normalizeVersion } from "../../domain/services/versioning.js";
export const OSV_ECOSYSTEMS = { npm: "npm", composer: "Packagist" };
const SEVERITIES = { critical: "critical", high: "high", moderate: "moderate", medium: "moderate", low: "low" };
const RANGE_TYPES = new Set(["SEMVER", "ECOSYSTEM"]);
const SUMMARY_LENGTH = 200;
// Vulns de OSV reducidas al paquete consultado (una vuln suele listar paquetes hermanos).
export function mapOsvVulns(ecosystem, name, vulns) {
    return vulns.flatMap((vuln) => {
        const affected = vuln.affected?.filter((entry) => entry.package?.name === name && entry.package.ecosystem === OSV_ECOSYSTEMS[ecosystem]) ?? [];
        if (affected.length === 0) {
            return [];
        }
        return [
            {
                id: vuln.id,
                aliases: vuln.aliases ?? [],
                summary: vuln.summary ?? (vuln.details ?? "").slice(0, SUMMARY_LENGTH),
                severity: severityOf(vuln.database_specific?.severity),
                ranges: affected.flatMap((entry) => entry.ranges?.filter((range) => RANGE_TYPES.has(range.type)).flatMap((range) => rangesFrom(range.events)) ?? []),
                versions: affected.flatMap((entry) => entry.versions?.map(normalizeVersion) ?? []).filter((version) => version !== null),
            },
        ];
    });
}
function severityOf(raw) {
    return (raw && SEVERITIES[raw.toLowerCase()]) || "unknown";
}
// Cada "introduced" abre un tramo que cierra el siguiente "fixed" o "last_affected". Las versiones
// quedan normalizadas; un tramo con alguna version ilegible se descarta.
function rangesFrom(events) {
    const ranges = [];
    for (const event of events) {
        if (event.introduced !== undefined) {
            ranges.push({ introduced: event.introduced, fixed: null, lastAffected: null });
        }
        else {
            const open = ranges[ranges.length - 1];
            open.fixed = event.fixed ?? null;
            open.lastAffected = event.last_affected ?? null;
        }
    }
    return ranges.flatMap((range) => {
        const normalized = { introduced: normalizeVersion(range.introduced), fixed: normalizeBound(range.fixed), lastAffected: normalizeBound(range.lastAffected) };
        return Object.values(normalized).includes(undefined) || normalized.introduced === null ? [] : [normalized];
    });
}
// null = sin limite; undefined = version ilegible (descarta el tramo).
function normalizeBound(bound) {
    return bound === null ? null : (normalizeVersion(bound) ?? undefined);
}
