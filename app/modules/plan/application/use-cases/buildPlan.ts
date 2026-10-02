import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";
import type { PlanGraph } from "../../domain/value-objects/Plan.js";
import { auditCategoriesFor } from "../../../audit/domain/services/auditCategories.js";
import { buildPlanGraph } from "../../domain/services/buildPlanGraph.js";
import { generatePlan } from "../../domain/services/generatePlan.js";
import type { PlanTaskStateRepository } from "../contracts/PlanTaskStateRepository.js";
import { auditSnapshotToSignals } from "../services/auditSnapshotToSignals.js";

export function buildPlan(snapshot: AuditSnapshot, repository: PlanTaskStateRepository, project: string): PlanGraph {
  const tasks = generatePlan(auditSnapshotToSignals(snapshot));

  const graph = buildPlanGraph(tasks, repository.getStates(snapshot.target, project), new Date().toISOString());

  return { ...graph, checks: auditedChecks(snapshot) };
}

// Lo que audito el stack, con su conteo: con cero tareas el plan puede mostrarlo en verde.
function auditedChecks(snapshot: AuditSnapshot) {
  const target = snapshot.target === "react" ? "react" : "laravel";
  return auditCategoriesFor(target).map((check) => ({ ...check, findings: snapshot.summary.by_category[check.category] ?? 0 }));
}
