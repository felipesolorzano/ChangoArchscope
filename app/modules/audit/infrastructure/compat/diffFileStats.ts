import type { FileStat } from "../cache/fingerprintFromStats.js";

export type CachedStat = { mtimeMs: number; size: number };

/**
 * Compara el estado cacheado (por ruta) contra el actual y clasifica que archivos hay que
 * re-escanear. Puro. `changed` = nuevos o con mtime/size distinto; `deleted` = estaban en
 * cache y ya no existen.
 */
export function diffFileStats(
  cached: Map<string, CachedStat>,
  current: FileStat[],
): { changed: string[]; deleted: string[] } {
  const changed: string[] = [];
  const currentPaths = new Set<string>();

  for (const file of current) {
    currentPaths.add(file.path);
    const previous = cached.get(file.path);
    if (previous === undefined || previous.mtimeMs !== file.mtimeMs || previous.size !== file.size) {
      changed.push(file.path);
    }
  }

  const deleted: string[] = [];
  for (const path of cached.keys()) {
    if (!currentPaths.has(path)) {
      deleted.push(path);
    }
  }

  return { changed, deleted };
}
