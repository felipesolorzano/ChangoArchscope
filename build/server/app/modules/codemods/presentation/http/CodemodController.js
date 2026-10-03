import { buildCodemodPlan } from "../../application/use-cases/buildCodemodPlan.js";
// /codemods.json?target=: APIs legacy agrupadas por patron con su herramienta (XRay X5).
export class CodemodController {
    sources;
    constructor(sources) {
        this.sources = sources;
    }
    show = async (request, response, next) => {
        try {
            const target = request.query.target === "react" ? "react" : "laravel";
            const snapshot = await this.sources.snapshots.getSnapshot(target);
            response.status(200).json(buildCodemodPlan({ snapshot, sourceRoot: this.sources.rootOf(target), stack: target }));
        }
        catch (error) {
            next(error);
        }
    };
}
