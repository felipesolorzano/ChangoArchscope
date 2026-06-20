import { buildRiskBreakdown } from "./auditRiskBreakdown.js";
import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";
export function buildAuditSnapshot(findings, context) {
    const skippedFiles = context.skippedFiles ?? [];
    return {
        generatedAt: new Date().toISOString(),
        target: context.target,
        module: context.module,
        summary: {
            files_scanned: context.filesScanned,
            files_skipped: skippedFiles.length,
            modules: context.modules,
            findings_count: findings.length,
            by_category: countBy(findings, (finding) => finding.category),
            by_severity: countBy(findings, (finding) => finding.severity),
        },
        findings,
        riskScore: buildRiskScore(findings),
        riskBreakdown: buildRiskBreakdown(findings, context.phpRoot),
        skippedFiles,
    };
}
function buildRiskScore(findings) {
    const breakdown = {};
    let value = 0;
    for (const finding of findings) {
        const weight = SEVERITY_WEIGHTS[finding.severity];
        breakdown[finding.category] = (breakdown[finding.category] ?? 0) + weight;
        value += weight;
    }
    return { value, breakdown };
}
function countBy(items, keyFn) {
    const counts = {};
    for (const item of items) {
        const key = keyFn(item);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}
