import { detectDependencies } from "../../application/use-cases/detectDependencies.js";
// Inventario de dependencias del stack pedido (raiz = modulesPath, con sus ignoredPaths).
export class DependenciesController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = (request, response, next) => {
        try {
            const target = request.query.target === "react" ? "react" : "laravel";
            const stack = this.deps.getConfig()[target];
            response.status(200).json(detectDependencies({ target, root: stack.modulesPath, ignoredPaths: stack.ignoredPaths, reader: this.deps.reader, probe: this.deps.probe }));
        }
        catch (error) {
            next(error);
        }
    };
}
