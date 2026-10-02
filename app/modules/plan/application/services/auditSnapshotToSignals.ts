import type { AuditSnapshot } from "../../../audit/domain/value-objects/AuditSnapshot.js";
import { findDuplicateMigrationPairs } from "../../domain/services/findDuplicateMigrationPairs.js";
import type { PlanSignals } from "../../domain/value-objects/Plan.js";

// Adaptador entre bounded contexts: traduce el AuditSnapshot (del que solo conocemos el tipo)
// a las señales que necesita el generador del plan. Asi el dominio de `plan` no depende de `audit`.
export function auditSnapshotToSignals(snapshot: AuditSnapshot): PlanSignals {
  const findingCounts: PlanSignals["findingCounts"] = {};

  for (const finding of snapshot.findings) {
    const bySeverity = (findingCounts[finding.rule] ??= {});
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
  }

  return {
    findingCounts,
    categoryCounts: snapshot.summary.by_category,
    duplicatePairs: findDuplicateMigrationPairs(snapshot.riskBreakdown.byFile.map((entry) => entry.key)).length,
    skippedFiles: snapshot.skippedFiles.length,
  };
}
