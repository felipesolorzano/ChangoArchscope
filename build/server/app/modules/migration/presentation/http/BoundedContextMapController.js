import { normalizeBoundedContextMap } from "../../domain/services/normalizeBoundedContextMap.js";
export class BoundedContextMapController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = (request, response, next) => {
        try {
            const map = this.deps.repository.getMap(targetFromRequest(request)) ?? emptyMap();
            response.status(200).json(map);
        }
        catch (error) {
            next(error);
        }
    };
    save = (request, response, next) => {
        try {
            const map = normalizeBoundedContextMap(request.body);
            this.deps.repository.saveMap(targetFromRequest(request), map);
            response.status(200).json(map);
        }
        catch (error) {
            next(error);
        }
    };
    // Le indica al agente la raiz del proyecto y los archivos en alcance para analizarlos.
    source = (request, response, next) => {
        try {
            response.status(200).json(this.deps.source.getSource(targetFromRequest(request)));
        }
        catch (error) {
            next(error);
        }
    };
}
function targetFromRequest(request) {
    return typeof request.query.target === "string" && request.query.target.length > 0 ? request.query.target : "laravel";
}
function emptyMap() {
    return { generatedAt: new Date().toISOString(), modules: [] };
}
