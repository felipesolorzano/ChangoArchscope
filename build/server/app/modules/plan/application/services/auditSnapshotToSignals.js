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
        topRiskUntested: topRiskUntested(snapshot),
    };
}
const TOP_RISK_FILES = 10;
const DISCARDED_RULES = new Set(["manual-copy-file", "possibly-unused-file"]);
// XRay X6: de los archivos mas riesgosos (escaneados, sin copias ni muertos), cuantos no tienen tests.
function topRiskUntested(snapshot) {
    const scanned = new Set(snapshot.scannedFiles);
    const discarded = new Set(snapshot.findings.filter((finding) => DISCARDED_RULES.has(finding.rule)).map((finding) => finding.file));
    // Un snapshot cacheado antes de X5 no trae testedBy.
    const testedBy = snapshot.testedBy ?? {};
    return snapshot.riskBreakdown.byFile
        .filter((entry) => scanned.has(entry.key) && !discarded.has(entry.key))
        .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key))
        .slice(0, TOP_RISK_FILES)
        .filter((entry) => testedBy[entry.key] === undefined).length;
}
