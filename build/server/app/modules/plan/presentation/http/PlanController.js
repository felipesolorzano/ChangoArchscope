import { buildPlan } from "../../application/use-cases/buildPlan.js";
import { findingsForTask } from "../../application/use-cases/findingsForTask.js";
import { updateTaskState } from "../../application/use-cases/updateTaskState.js";
export class PlanController {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    show = async (request, response, next) => {
        try {
            const target = targetFromRequest(request);
            const snapshot = await this.deps.snapshots.getSnapshot(target);
            response.status(200).json(buildPlan(snapshot, this.deps.repository, this.deps.projectOf(target), await this.dependencies(target), await this.protectionLevel(target)));
        }
        catch (error) {
            next(error);
        }
    };
    update = async (request, response, next) => {
        try {
            // La ruta /plan/tasks/:key garantiza `key`; el estado se valida en updateTaskState.
            const target = targetFromRequest(request);
            const state = typeof request.body?.state === "string" ? request.body.state : "";
            const project = this.deps.projectOf(target);
            updateTaskState(this.deps.repository, target, project, String(request.params.key), state);
            const snapshot = await this.deps.snapshots.getSnapshot(target);
            response.status(200).json(buildPlan(snapshot, this.deps.repository, project, await this.dependencies(target), await this.protectionLevel(target)));
        }
        catch (error) {
            next(error);
        }
    };
    findings = async (request, response, next) => {
        try {
            const target = targetFromRequest(request);
            const snapshot = await this.deps.snapshots.getSnapshot(target);
            response.status(200).json(findingsForTask(snapshot, String(request.params.key), await this.dependencies(target)));
        }
        catch (error) {
            next(error);
        }
    };
    // El reporte de dependencias es opcional: si no hay proveedor o falla, el plan sale sin esas tareas.
    async dependencies(target) {
        return this.deps.dependencySignals?.getSignals(target).catch(() => undefined);
    }
    async protectionLevel(target) {
        // Stryker disable next-line ArrowFunction: null y undefined son "sin datos" para las fases, mutante equivalente.
        return (await this.deps.protection?.getLevel(target).catch(() => null)) ?? null;
    }
}
function targetFromRequest(request) {
    return request.query.target === "react" ? "react" : "laravel";
}
