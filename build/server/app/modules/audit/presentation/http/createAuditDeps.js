import { resolve } from "node:path";
import { checkArchitecture } from "../../../architecture/application/checkArchitecture.js";
import { getArchitectureConfig } from "../../../architecture/infrastructure/config/architectureConfigStore.js";
import { NodeFsSourceTreeReader } from "../../../shared/infrastructure/filesystem/NodeFsSourceTreeReader.js";
import { createAuditSnapshotCache } from "../../application/use-cases/AuditSnapshotCache.js";
import { createRepoFingerprint } from "../../infrastructure/cache/computeRepoFingerprint.js";
import { IncrementalDockerPhpcsScanner } from "../../infrastructure/compat/IncrementalDockerPhpcsScanner.js";
import { PhpAstParser } from "../../infrastructure/parser/PhpAstParser.js";
import { IncrementalPhpFileScanner } from "../../infrastructure/scan/IncrementalPhpFileScanner.js";
const DOCKERFILE_DIR = resolve(process.cwd(), "tools/php-compatibility");
// El scan de compatibilidad es caro (Docker). El wrapper cachea por (repo, version, exts) +
// fingerprint y comparte el Promise (anti-stampede entre requests que solo difieren por modulo).
// El fingerprint en la llave hace que editar un archivo invalide el resultado.
function createCachedCompatibilityScan(reader) {
    const scanner = new IncrementalDockerPhpcsScanner({ dockerfileDir: DOCKERFILE_DIR, reader });
    const cache = new Map();
    return (repoPath, phpVersion, extensions, fingerprint) => {
        const key = `${repoPath}|${phpVersion}|${extensions.join(",")}`;
        const existing = cache.get(key);
        if (existing !== undefined && existing.fingerprint === fingerprint) {
            return existing.pending;
        }
        const entry = { fingerprint, pending: scanner.scan(repoPath, phpVersion, extensions) };
        cache.set(key, entry);
        entry.pending.catch(() => {
            if (cache.get(key) === entry) {
                cache.delete(key);
            }
        });
        return entry.pending;
    };
}
let shared = null;
/**
 * Deps de audit como singleton de proceso. Los caches (snapshot, compat, scan nativo) y el
 * fingerprint viven aqui para reusarse entre cargas y entre modulos: tanto `audit` como `plan`
 * usan estas mismas deps, asi comparten la entrada `laravel||` del snapshot cache y los scanners
 * incrementales. El CLI NO usa esto (corre una sola vez, sin estado que reusar).
 */
export function getAuditDeps() {
    if (shared === null) {
        const reader = new NodeFsSourceTreeReader();
        const parser = new PhpAstParser();
        const nativeScanner = new IncrementalPhpFileScanner(reader, parser);
        shared = {
            getConfig: getArchitectureConfig,
            reader,
            parser,
            check: checkArchitecture,
            resolveCompatibility: createCachedCompatibilityScan(reader),
            snapshotCache: createAuditSnapshotCache(),
            fingerprint: createRepoFingerprint(reader),
            scanFiles: (phpRoot, extensions, ignoredPaths) => nativeScanner.scan(phpRoot, extensions, ignoredPaths),
        };
    }
    return shared;
}
