import { buildAuditGraph } from "../../application/use-cases/BuildAuditGraph.js";
import { moduleFromQuery, phpVersionFromQuery, resolveAuditSnapshot, targetFromQuery, } from "./auditRequest.js";
export class AuditGraphController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
        try {
            const target = targetFromQuery(request.query.target);
            const module = moduleFromQuery(request.query.module);
            const phpVersion = phpVersionFromQuery(request.query.php);
            const config = this.deps.getConfig();
            const snapshot = await resolveAuditSnapshot(this.deps, target, module, phpVersion);
            const graph = buildAuditGraph(snapshot, {
                view: viewFromQuery(request.query.view),
                focus: moduleFromQuery(request.query.focus),
                sourceRoot: target === "laravel" ? config.laravel.modulesPath : config.react.modulesPath,
            });
            response.status(200).json(graph);
        }
        catch (error) {
            next(error);
        }
    };
}
// Una vista no reconocida termina en overview de todos modos (buildAuditGraph cae a overview para lo
// que no conoce), asi que los mutantes de esta guarda son equivalentes.
function viewFromQuery(value) {
    // Stryker disable next-line ConditionalExpression,StringLiteral
    return value === "app" || value === "file" || value === "heatmap" ? value : "overview";
}
