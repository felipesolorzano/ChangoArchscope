import { moduleFromQuery, resolveAuditSnapshot, targetFromQuery, } from "./auditRequest.js";
export class AuditController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = (request, response, next) => {
        try {
            const target = targetFromQuery(request.query.target);
            const module = moduleFromQuery(request.query.module);
            const snapshot = resolveAuditSnapshot(this.deps, target, module);
            response.status(200).json(snapshot);
        }
        catch (error) {
            next(error);
        }
    };
}
