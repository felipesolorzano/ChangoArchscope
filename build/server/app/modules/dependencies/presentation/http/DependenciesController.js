import { generateDependencyReport } from "../../application/use-cases/generateDependencyReport.js";
const RUNTIME_KINDS = ["php", "node", "npm"];
// /dependencies.json?target=&php=&node=&npm=&refresh=1: reporte del stack con el runtime pedido.
export class DependenciesController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
        try {
            const report = await generateDependencyReport(this.deps, {
                target: request.query.target === "react" ? "react" : "laravel",
                requested: requestedRuntimes(request.query),
                refresh: request.query.refresh === "1",
                offline: false,
            });
            response.status(200).json(report);
        }
        catch (error) {
            next(error);
        }
    };
}
function requestedRuntimes(query) {
    return Object.fromEntries(RUNTIME_KINDS.filter((kind) => typeof query[kind] === "string").map((kind) => [kind, query[kind]]));
}
