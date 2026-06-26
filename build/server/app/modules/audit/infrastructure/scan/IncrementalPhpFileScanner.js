import { statSync } from "node:fs";
import { diffFileStats } from "../compat/diffFileStats.js";
/**
 * Scan nativo incremental: cachea el `PhpFileStructure` (o el fallo de parseo) por archivo y
 * solo vuelve a leer+parsear los archivos que cambiaron (mtime/size). Reduce el recompute
 * nativo de ~7s (re-parsear todo) a <1s tras editar un archivo. Mismo resultado que
 * `scanPhpFiles` para el mismo arbol. Stateful + I/O; excluido de Stryker. La clasificacion
 * changed/deleted reusa `diffFileStats` (puro).
 */
export class IncrementalPhpFileScanner {
    reader;
    parser;
    cache = new Map();
    constructor(reader, parser) {
        this.reader = reader;
        this.parser = parser;
    }
    scan(phpRoot, extensions, ignoredPaths) {
        const current = this.statFiles(phpRoot, extensions, ignoredPaths);
        const cachedStats = new Map([...this.cache].map(([path, entry]) => [path, { mtimeMs: entry.mtimeMs, size: entry.size }]));
        const { changed, deleted } = diffFileStats(cachedStats, current);
        for (const path of deleted) {
            this.cache.delete(path);
        }
        const currentByPath = new Map(current.map((file) => [file.path, file]));
        for (const path of changed) {
            const stat = currentByPath.get(path);
            if (stat !== undefined) {
                this.cache.set(path, { mtimeMs: stat.mtimeMs, size: stat.size, result: this.parseFile(path) });
            }
        }
        const files = [];
        const skipped = [];
        for (const [, entry] of [...this.cache.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            if (entry.result.ok) {
                files.push(entry.result.structure);
            }
            else {
                skipped.push(entry.result.failure);
            }
        }
        return { files, skipped };
    }
    parseFile(file) {
        try {
            return { ok: true, structure: this.parser.parse(file, this.reader.readText(file)) };
        }
        catch (error) {
            return { ok: false, failure: { file, error: error instanceof Error ? error.message : String(error) } };
        }
    }
    statFiles(phpRoot, extensions, ignoredPaths) {
        const stats = [];
        for (const file of this.reader.walkFiles(phpRoot, extensions, ignoredPaths)) {
            try {
                const info = statSync(file);
                stats.push({ path: file, mtimeMs: info.mtimeMs, size: info.size });
            }
            catch {
                // archivo desaparecido entre walk y stat: se omite.
            }
        }
        return stats;
    }
}
