import { auditProject } from "../../application/use-cases/AuditProject.js";
export function targetFromQuery(value) {
    return value === "react" ? "react" : "laravel";
}
export function moduleFromQuery(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
// Composition root compartido por los endpoints de audit: configura, corre el check de
// arquitectura y arma el AuditSnapshot completo para un target/module dados.
export function resolveAuditSnapshot(deps, target, module) {
    const config = deps.getConfig();
    const checkResult = deps.check(config, deps.reader, { target, module });
    return auditProject({
        checkResult,
        reader: deps.reader,
        parser: deps.parser,
        phpRoot: target === "laravel" ? config.laravel.modulesPath : null,
        phpExtensions: config.laravel.phpExtensions,
        ignoredPaths: config.laravel.ignoredPaths,
    });
}
