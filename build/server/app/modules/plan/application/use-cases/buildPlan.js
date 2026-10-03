import { buildAuditHealth } from "../../../audit/application/use-cases/BuildAuditHealth.js";
import { auditCategoriesFor } from "../../../audit/domain/services/auditCategories.js";
import { buildPlanGraph } from "../../domain/services/buildPlanGraph.js";
import { generatePlan } from "../../domain/services/generatePlan.js";
import { planPhases } from "../../domain/services/planPhases.js";
import { auditSnapshotToSignals } from "../services/auditSnapshotToSignals.js";
export function buildPlan(snapshot, repository, project, dependencies, protectionLevel = null) {
    const stack = snapshot.target === "react" ? "react" : "laravel";
    const signals = {
        ...auditSnapshotToSignals(snapshot),
        dependencies,
        protectionLevel,
        healthyPercent: buildAuditHealth(snapshot, project, stack).summary.healthyPercent,
    };
    const tasks = generatePlan(signals);
    const graph = buildPlanGraph(tasks, repository.getStates(snapshot.target, project), new Date().toISOString());
    return {
        ...graph,
        checks: auditedChecks(snapshot, stack),
        phases: planPhases(signals, stack, tasks.map((task) => task.key)),
    };
}
// Lo que audito el stack, con su conteo: con cero tareas el plan puede mostrarlo en verde.
function auditedChecks(snapshot, stack) {
    return auditCategoriesFor(stack).map((check) => ({ ...check, findings: snapshot.summary.by_category[check.category] ?? 0 }));
}
