import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";
import type { PlanGraph } from "../../domain/value-objects/Plan.js";
import { buildPlanGraph } from "../../domain/services/buildPlanGraph.js";
import { generatePlan } from "../../domain/services/generatePlan.js";
import type { PlanTaskStateRepository } from "../contracts/PlanTaskStateRepository.js";
import { auditSnapshotToSignals } from "../services/auditSnapshotToSignals.js";

export function buildPlan(snapshot: AuditSnapshot, repository: PlanTaskStateRepository): PlanGraph {
  const tasks = generatePlan(auditSnapshotToSignals(snapshot));

  return buildPlanGraph(tasks, repository.getStates(), new Date().toISOString());
}
