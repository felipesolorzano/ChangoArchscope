import path from "node:path";
import { auditCategoriesFor } from "../../domain/services/auditCategories.js";
import { dominantAccent, toneForSeverity } from "../../domain/services/auditGraphLayout.js";
const ROOT_GROUP_LABEL = "(raíz)";
// Salud del proyecto entero: cuantos archivos estan sanos, que categorias se auditaron y un tile por
// archivo (sano o no) agrupado por carpeta, para el mosaico.
export function buildAuditHealth(snapshot, sourceRoot, target) {
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
function toTile(relativePath, entry) {
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
function groupTiles(tiles) {
    const groups = new Map();
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
