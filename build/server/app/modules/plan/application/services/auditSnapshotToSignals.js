import { findDuplicateMigrationPairs } from "../../domain/services/findDuplicateMigrationPairs.js";
// Adaptador entre bounded contexts: traduce el AuditSnapshot (del que solo conocemos el tipo)
// a las señales que necesita el generador del plan. Asi el dominio de `plan` no depende de `audit`.
export function auditSnapshotToSignals(snapshot) {
    const findingCounts = {};
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
