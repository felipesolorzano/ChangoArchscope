import path from "node:path";

import type { AuditGraphAccent, AuditGraphTone } from "../../domain/value-objects/AuditGraph.js";
import type { AuditSnapshot, RiskEntry } from "../../domain/value-objects/AuditSnapshot.js";
import { auditCategoriesFor } from "../../domain/services/auditCategories.js";
import { dominantAccent, toneForSeverity } from "../../domain/services/auditGraphLayout.js";

export type AuditHealthTile = { path: string; label: string; findings: number; risk: number; tone: AuditGraphTone; accent: AuditGraphAccent };
export type AuditHealthGroup = { key: string; label: string; files: number; withFindings: number; tiles: AuditHealthTile[] };
export type AuditHealth = {
  summary: { files: number; healthy: number; withFindings: number; healthyPercent: number };
  checks: Array<{ category: string; label: string; findings: number }>;
  groups: AuditHealthGroup[];
};

const ROOT_GROUP_LABEL = "(raíz)";

// Salud del proyecto entero: cuantos archivos estan sanos, que categorias se auditaron y un tile por
// archivo (sano o no) agrupado por carpeta, para el mosaico.
export function buildAuditHealth(snapshot: AuditSnapshot, sourceRoot: string, target: "laravel" | "react"): AuditHealth {
  const entries = new Map(snapshot.riskBreakdown.byFile.map((entry) => [entry.key, entry]));
  const universe = [...new Set([...snapshot.scannedFiles, ...entries.keys()])];
  const tiles = universe
    .map((file) => toTile(path.relative(sourceRoot, file).split(path.sep).join("/"), entries.get(file)))
    .sort((a, b) => a.path.localeCompare(b.path));
  const withFindings = tiles.filter((tile) => tile.findings > 0).length;

  return {
    summary: {
      files: tiles.length,
      healthy: tiles.length - withFindings,
      withFindings,
      healthyPercent: tiles.length === 0 ? 100 : Math.round(((tiles.length - withFindings) / tiles.length) * 100),
    },
    checks: auditCategoriesFor(target).map((check) => ({ ...check, findings: snapshot.summary.by_category[check.category] ?? 0 })),
    groups: groupTiles(tiles),
  };
}

function toTile(relativePath: string, entry: RiskEntry | undefined): AuditHealthTile {
  return {
    path: relativePath,
    label: path.posix.basename(relativePath),
    findings: entry?.findingsCount ?? 0,
    risk: entry?.value ?? 0,
    tone: toneForSeverity(entry?.bySeverity ?? {}),
    accent: dominantAccent(entry?.byCategory ?? {}),
  };
}

// Un grupo por primera carpeta; los archivos sueltos en la raiz van al grupo "".
function groupTiles(tiles: AuditHealthTile[]): AuditHealthGroup[] {
  const groups = new Map<string, AuditHealthTile[]>();

  for (const tile of tiles) {
    const key = tile.path.includes("/") ? tile.path.split("/")[0] : "";
    groups.set(key, [...(groups.get(key) ?? []), tile]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupTiles]) => ({
      key,
      label: key === "" ? ROOT_GROUP_LABEL : key,
      files: groupTiles.length,
      withFindings: groupTiles.filter((tile) => tile.findings > 0).length,
      tiles: groupTiles,
    }));
}
