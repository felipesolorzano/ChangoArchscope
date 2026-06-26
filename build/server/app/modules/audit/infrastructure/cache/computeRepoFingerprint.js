import { statSync } from "node:fs";
import { relative } from "node:path";
import { fingerprintFromStats } from "./fingerprintFromStats.js";
/**
 * Fingerprint barato del repo: recorre los mismos archivos que escanea el audit y los
 * `stat`ea (mtime + size) SIN leer contenido ni parsear. Es la unica pieza con I/O; el
 * hash en si lo hace `fingerprintFromStats` (puro). Se excluye de Stryker como el resto de
 * adapters de I/O.
 */
export function createRepoFingerprint(reader) {
    return async (repoPath, extensions, ignoredPaths) => {
        const stats = [];
        for (const file of reader.walkFiles(repoPath, extensions, ignoredPaths)) {
            try {
                const info = statSync(file);
                stats.push({ path: relative(repoPath, file), mtimeMs: info.mtimeMs, size: info.size });
            }
            catch {
                // Un archivo que desaparecio entre el walk y el stat: lo omitimos. Su ausencia ya
                // cambia el conjunto, asi que el fingerprint refleja el cambio igualmente.
            }
        }
        return fingerprintFromStats(stats);
    };
}
