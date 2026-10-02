import { buildAuditHealth } from "../../application/use-cases/BuildAuditHealth.js";
import { moduleFromQuery, phpVersionFromQuery, resolveAuditSnapshot, targetFromQuery, } from "./auditRequest.js";
// Salud del proyecto (KPI, checklist y mosaico) sobre el mismo snapshot cacheado del audit.
export class AuditHealthController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
        try {
            const target = targetFromQuery(request.query.target);
            const config = this.deps.getConfig();
            const snapshot = await resolveAuditSnapshot(this.deps, target, moduleFromQuery(request.query.module), phpVersionFromQuery(request.query.php));
            const sourceRoot = target === "laravel" ? config.laravel.modulesPath : config.react.modulesPath;
            response.status(200).json(buildAuditHealth(snapshot, sourceRoot, target));
        }
        catch (error) {
            next(error);
        }
    };
}
