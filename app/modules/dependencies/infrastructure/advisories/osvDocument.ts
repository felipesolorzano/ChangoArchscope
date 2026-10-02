import type { Ecosystem } from "../../domain/value-objects/Dependency.js";
import { normalizeVersion } from "../../domain/services/versioning.js";
import type { Advisory, AffectedRange, Severity } from "../../domain/value-objects/Security.js";

type OsvEvent = { introduced?: string; fixed?: string; last_affected?: string };
type OsvAffected = { package?: { name?: string; ecosystem?: string }; ranges?: Array<{ type: string; events: OsvEvent[] }>; versions?: string[] };
export type OsvVuln = {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  database_specific?: { severity?: string };
  affected?: OsvAffected[];
};

export const OSV_ECOSYSTEMS: Record<Ecosystem, string> = { npm: "npm", composer: "Packagist" };

const SEVERITIES: Record<string, Severity> = { critical: "critical", high: "high", moderate: "moderate", medium: "moderate", low: "low" };
const RANGE_TYPES = new Set(["SEMVER", "ECOSYSTEM"]);
const SUMMARY_LENGTH = 200;

// Vulns de OSV reducidas al paquete consultado (una vuln suele listar paquetes hermanos).
export function mapOsvVulns(ecosystem: Ecosystem, name: string, vulns: OsvVuln[]): Advisory[] {
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
        versions: affected.flatMap((entry) => entry.versions?.map(normalizeVersion) ?? []).filter((version): version is string => version !== null),
      },
    ];
  });
}

function severityOf(raw: string | undefined): Severity {
  return (raw && SEVERITIES[raw.toLowerCase()]) || "unknown";
}

// Cada "introduced" abre un tramo que cierra el siguiente "fixed" o "last_affected". Las versiones
// quedan normalizadas; un tramo con alguna version ilegible se descarta.
function rangesFrom(events: OsvEvent[]): AffectedRange[] {
  const ranges: Array<Record<keyof AffectedRange, string | null>> = [];

  for (const event of events) {
    if (event.introduced !== undefined) {
      ranges.push({ introduced: event.introduced, fixed: null, lastAffected: null });
    } else {
      const open = ranges[ranges.length - 1];
      open.fixed = event.fixed ?? null;
      open.lastAffected = event.last_affected ?? null;
    }
  }

  return ranges.flatMap((range) => {
    const normalized = { introduced: normalizeVersion(range.introduced as string), fixed: normalizeBound(range.fixed), lastAffected: normalizeBound(range.lastAffected) };
    return Object.values(normalized).includes(undefined) || normalized.introduced === null ? [] : [normalized as AffectedRange];
  });
}

// null = sin limite; undefined = version ilegible (descarta el tramo).
function normalizeBound(bound: string | null): string | null | undefined {
  return bound === null ? null : (normalizeVersion(bound) ?? undefined);
}
