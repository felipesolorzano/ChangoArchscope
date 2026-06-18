import type { ArchitectureCheckResult, ArchitectureIssue } from "../../../architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { AuditFinding, AuditFindingSeverity, AuditSnapshot } from "../../domain/value-objects/AuditSnapshot.js";
import { buildAuditSnapshot } from "../../domain/services/auditSnapshotBuilder.js";

export function runAudit(checkResult: ArchitectureCheckResult): AuditSnapshot {
  return buildAuditSnapshot(architectureFindings(checkResult), {
    target: checkResult.target,
    module: checkResult.module,
    filesScanned: checkResult.summary.files_scanned,
    modules: checkResult.summary.modules,
  });
}

export function architectureFindings(checkResult: ArchitectureCheckResult): AuditFinding[] {
  return checkResult.reports.flatMap((report) => [
    ...report.violations.map((issue) => toFinding(issue, "architecture_violation", "layer-violation", "high")),
    ...report.couplings.map((issue) => toFinding(issue, "coupling_module", "module-coupling", "medium")),
  ]);
}

function toFinding(
  issue: ArchitectureIssue,
  category: string,
  rule: string,
  severity: AuditFindingSeverity,
): AuditFinding {
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

function extractDetails(issue: ArchitectureIssue): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  if (issue.target_module !== undefined) details.target_module = issue.target_module;
  if (issue.assessment !== undefined) details.assessment = issue.assessment;
  if (issue.recommendation !== undefined) details.recommendation = issue.recommendation;
  if (issue.action !== undefined) details.action = issue.action;

  return details;
}
