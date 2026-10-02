import { buildCharacterizationPlan } from "../../application/use-cases/buildCharacterizationPlan.js";
// /characterization.json?target=: que proteger primero y esqueletos de tests (XRay X4).
export class CharacterizationController {
    sources;
    constructor(sources) {
        this.sources = sources;
    }
    show = async (request, response, next) => {
        try {
            const target = request.query.target === "react" ? "react" : "laravel";
            const snapshot = await this.sources.snapshots.getSnapshot(target);
            response.status(200).json(buildCharacterizationPlan({ snapshot, graph: this.sources.graphOf(target), sourceRoot: this.sources.rootOf(target), stack: target }));
        }
        catch (error) {
            next(error);
        }
    };
}
