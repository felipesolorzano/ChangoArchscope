import { auditProject } from "../../application/use-cases/AuditProject.js";
const PHP_VERSION_PATTERN = /^\d+\.\d+$/;
export function targetFromQuery(value) {
    return value === "react" ? "react" : "laravel";
}
export function moduleFromQuery(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
export function phpVersionFromQuery(value) {
    return typeof value === "string" && PHP_VERSION_PATTERN.test(value) ? value : null;
}
// Composition root compartido por los endpoints de audit: configura, corre el check de
// arquitectura y arma el AuditSnapshot completo para un target/module dados. Si se pide
// una version de PHP y hay scanner de compatibilidad, incluye la categoria php_compatibility.
export async function resolveAuditSnapshot(deps, target, module, phpVersion = null) {
    const config = deps.getConfig();
    const phpRoot = target === "laravel" ? config.laravel.modulesPath : null;
    // Fingerprint barato (mtime+size). Invalida tanto el cache de snapshot como el de compat,
    // para que ambos refresquen de forma consistente cuando se edita un archivo del repo.
    const fingerprint = deps.fingerprint !== undefined && phpRoot !== null
        ? await deps.fingerprint(phpRoot, config.laravel.phpExtensions, config.laravel.ignoredPaths)
        : null;
    // Lo caro de hoy: check de arquitectura + scan de compat + parseo/analisis de todos los
    // archivos PHP. Se envuelve en un closure para poder saltarlo via cache en un hit.
    const compute = async () => {
        const checkResult = deps.check(config, deps.reader, { target, module });
        const compatibilityScan = phpVersion !== null && phpRoot !== null && deps.resolveCompatibility !== undefined
            ? await deps.resolveCompatibility(phpRoot, phpVersion, config.laravel.phpExtensions, fingerprint)
            : undefined;
        return auditProject({
            checkResult,
            reader: deps.reader,
            parser: deps.parser,
            phpRoot,
            phpExtensions: config.laravel.phpExtensions,
            ignoredPaths: config.laravel.ignoredPaths,
            compatibilityScan,
            scanFiles: deps.scanFiles,
        });
    };
    if (deps.snapshotCache !== undefined && fingerprint !== null) {
        // Incluye phpRoot en la llave: si cambia el modulesPath (otro repo), no se sirve un
        // snapshot cacheado del repo anterior.
        const key = `${phpRoot ?? ""}|${target}|${module ?? ""}|${phpVersion ?? ""}`;
        return deps.snapshotCache.resolve(key, fingerprint, compute);
    }
    return compute();
}
