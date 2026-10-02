import { buildPlanGraph } from "../../domain/services/buildPlanGraph.js";
import { generatePlan } from "../../domain/services/generatePlan.js";
import { auditSnapshotToSignals } from "../services/auditSnapshotToSignals.js";
export function buildPlan(snapshot, repository, project) {
    const tasks = generatePlan(auditSnapshotToSignals(snapshot));
    return buildPlanGraph(tasks, repository.getStates(snapshot.target, project), new Date().toISOString());
}
