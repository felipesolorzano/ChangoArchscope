import type { PhpCompatibilityScanResult } from "../../domain/repositories/PhpCompatibilityScanner.js";
import type { PhpCompatibilityIssue } from "../../domain/value-objects/PhpCompatibilityIssue.js";
import type { AuditFinding, AuditFindingSeverity } from "../../domain/value-objects/AuditSnapshot.js";

const SEVERITY_BY_RAW: Record<PhpCompatibilityIssue["severityRaw"], AuditFindingSeverity> = {
  error: "high",
  warning: "medium",
};

export function phpCompatibilityAnalyzer(scan: PhpCompatibilityScanResult): AuditFinding[] {
  if (scan.status === "unavailable") return [];

  return scan.issues.map((issue) => buildFinding(issue, scan.targetPhp));
}

function buildFinding(issue: PhpCompatibilityIssue, targetPhp: string): AuditFinding {
  return {
    category: "php_compatibility",
    rule: issue.rule,
    severity: SEVERITY_BY_RAW[issue.severityRaw],
    source: "external",
    module: "",
    class: null,
    file: issue.file,
    line: issue.line,
    message: issue.message,
    details: { rule: issue.rule, targetPhp },
  };
}
