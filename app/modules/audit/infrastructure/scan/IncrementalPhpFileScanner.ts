import { statSync } from "node:fs";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { PhpFileStructure, PhpParseFailure } from "../../domain/value-objects/PhpFileStructure.js";
import type { PhpScanResult } from "../../application/use-cases/ScanPhpFiles.js";
import type { FileStat } from "../cache/fingerprintFromStats.js";
import { diffFileStats } from "../compat/diffFileStats.js";

type CachedResult =
  | { ok: true; structure: PhpFileStructure }
  | { ok: false; failure: PhpParseFailure };

type CacheEntry = { mtimeMs: number; size: number; result: CachedResult };

/**
 * Scan nativo incremental: cachea el `PhpFileStructure` (o el fallo de parseo) por archivo y
 * solo vuelve a leer+parsear los archivos que cambiaron (mtime/size). Reduce el recompute
 * nativo de ~7s (re-parsear todo) a <1s tras editar un archivo. Mismo resultado que
 * `scanPhpFiles` para el mismo arbol. Stateful + I/O; excluido de Stryker. La clasificacion
 * changed/deleted reusa `diffFileStats` (puro).
 */
export class IncrementalPhpFileScanner {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly reader: SourceTreeReader,
    private readonly parser: PhpSourceParser,
  ) {}

  scan(phpRoot: string, extensions: string[], ignoredPaths: string[]): PhpScanResult {
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

    const files: PhpFileStructure[] = [];
    const skipped: PhpParseFailure[] = [];

    for (const [, entry] of [...this.cache.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (entry.result.ok) {
        files.push(entry.result.structure);
      } else {
        skipped.push(entry.result.failure);
      }
    }

    return { files, skipped };
  }

  private parseFile(file: string): CachedResult {
    try {
      return { ok: true, structure: this.parser.parse(file, this.reader.readText(file)) };
    } catch (error) {
      return { ok: false, failure: { file, error: error instanceof Error ? error.message : String(error) } };
    }
  }

  private statFiles(phpRoot: string, extensions: string[], ignoredPaths: string[]): FileStat[] {
    const stats: FileStat[] = [];

    for (const file of this.reader.walkFiles(phpRoot, extensions, ignoredPaths)) {
      try {
        const info = statSync(file);
        stats.push({ path: file, mtimeMs: info.mtimeMs, size: info.size });
      } catch {
        // archivo desaparecido entre walk y stat: se omite.
      }
    }

    return stats;
  }
}
