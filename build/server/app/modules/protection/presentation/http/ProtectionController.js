import { buildProtectionBaseline } from "../../application/use-cases/buildProtectionBaseline.js";
const JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
// /protection.json?target=: linea base de proteccion del stack (XRay X3).
export class ProtectionController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = (request, response, next) => {
        try {
            const stack = protectionStackOf(this.deps.getConfig(), request.query.target);
            response.status(200).json(buildProtectionBaseline({ reader: this.deps.reader, ...stack }));
        }
        catch (error) {
            next(error);
        }
    };
}
/** Raiz, tests, extensiones e ignorados del stack (tambien la usa el Plan para el nivel, XRay X6). Cualquier target que no sea react es laravel. */
export function protectionStackOf(config, target) {
    return target === "react"
        ? { stackRoot: config.react.modulesPath, testPaths: config.react.testPaths ?? [], extensions: JS_EXTENSIONS, ignoredPaths: config.react.ignoredPaths }
        : { stackRoot: config.laravel.modulesPath, testPaths: [], extensions: config.laravel.phpExtensions, ignoredPaths: config.laravel.ignoredPaths };
}
