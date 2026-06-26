import { moduleFromQuery, phpVersionFromQuery, resolveAuditSnapshot, targetFromQuery, } from "./auditRequest.js";
export class AuditController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
        try {
            const target = targetFromQuery(request.query.target);
            const module = moduleFromQuery(request.query.module);
            const phpVersion = phpVersionFromQuery(request.query.php);
            const snapshot = await resolveAuditSnapshot(this.deps, target, module, phpVersion);
            response.status(200).json(snapshot);
        }
        catch (error) {
            next(error);
        }
    };
}
