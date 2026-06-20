import { buildPlan } from "../../application/use-cases/buildPlan.js";
import { updateTaskState } from "../../application/use-cases/updateTaskState.js";
export class PlanController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = (request, response, next) => {
        try {
            const snapshot = this.deps.snapshots.getSnapshot(targetFromRequest(request));
            response.status(200).json(buildPlan(snapshot, this.deps.repository));
        }
        catch (error) {
            next(error);
        }
    };
    update = (request, response, next) => {
        try {
            // La ruta /plan/tasks/:key garantiza `key`; el estado se valida en updateTaskState.
            const state = typeof request.body?.state === "string" ? request.body.state : "";
            updateTaskState(this.deps.repository, String(request.params.key), state);
            const snapshot = this.deps.snapshots.getSnapshot(targetFromRequest(request));
            response.status(200).json(buildPlan(snapshot, this.deps.repository));
        }
        catch (error) {
            next(error);
        }
    };
}
function targetFromRequest(request) {
    return request.query.target === "react" ? "react" : "laravel";
}
