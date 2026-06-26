/**
 * Compara el estado cacheado (por ruta) contra el actual y clasifica que archivos hay que
 * re-escanear. Puro. `changed` = nuevos o con mtime/size distinto; `deleted` = estaban en
 * cache y ya no existen.
 */
export function diffFileStats(cached, current) {
    const changed = [];
    const currentPaths = new Set();
    for (const file of current) {
        currentPaths.add(file.path);
        const previous = cached.get(file.path);
        if (previous === undefined || previous.mtimeMs !== file.mtimeMs || previous.size !== file.size) {
            changed.push(file.path);
        }
    }
    const deleted = [];
    for (const path of cached.keys()) {
        if (!currentPaths.has(path)) {
            deleted.push(path);
        }
    }
    return { changed, deleted };
}
