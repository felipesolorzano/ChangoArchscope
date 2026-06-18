import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";
export function runAudit(checkResult) {
    return buildAuditSnapshot(architectureFindings(checkResult), {
        target: checkResult.target,
        module: checkResult.module,
        filesScanned: checkResult.summary.files_scanned,
        modules: checkResult.summary.modules,
    });
}
export function architectureFindings(checkResult) {
    return checkResult.reports.flatMap((report) => [
        ...report.violations.map((issue) => toFinding(issue, "architecture_violation", "layer-violation", "high")),
        ...report.couplings.map((issue) => toFinding(issue, "coupling_module", "module-coupling", "medium")),
    ]);
}
function toFinding(issue, category, rule, severity) {
    return {
        category,
        rule,
        severity,
        source: "architecture",
        module: issue.module,
        class: null,
        file: issue.file,
        line: issue.line,
        message: issue.message,
        suggestion: issue.suggestion,
        details: extractDetails(issue),
    };
}
function extractDetails(issue) {
    const details = {};
    if (issue.target_module !== undefined)
        details.target_module = issue.target_module;
    if (issue.assessment !== undefined)
        details.assessment = issue.assessment;
    if (issue.recommendation !== undefined)
        details.recommendation = issue.recommendation;
    if (issue.action !== undefined)
        details.action = issue.action;
    return details;
}
