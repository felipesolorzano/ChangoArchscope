import type { AuditFinding, AuditScannerStatus, AuditSnapshot } from "../value-objects/AuditSnapshot.js";
import type { PhpParseFailure } from "../value-objects/PhpFileStructure.js";
import { buildRiskBreakdown } from "./auditRiskBreakdown.js";
import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";

export type AuditSnapshotContext = {
  target: string;
  module: string | null;
  filesScanned: number;
  modules: number;
  sourceRoot?: string;
  skippedFiles?: PhpParseFailure[];
  phpCompatibilityStatus?: AuditScannerStatus;
  scannedFiles?: string[];
  testedBy?: Record<string, string[]>;
};

export function buildAuditSnapshot(findings: AuditFinding[], context: AuditSnapshotContext): AuditSnapshot {
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
      ...(context.phpCompatibilityStatus !== undefined
        ? { scanners: { php_compatibility: context.phpCompatibilityStatus } }
        : {}),
    },
    findings,
    riskScore: buildRiskScore(findings),
    riskBreakdown: buildRiskBreakdown(findings, context.sourceRoot),
    skippedFiles,
    scannedFiles: context.scannedFiles ?? [],
    testedBy: context.testedBy ?? {},
  };
}

function buildRiskScore(findings: AuditFinding[]) {
  const breakdown: Record<string, number> = {};
  let value = 0;

  for (const finding of findings) {
    const weight = SEVERITY_WEIGHTS[finding.severity];

    breakdown[finding.category] = (breakdown[finding.category] ?? 0) + weight;
    value += weight;
  }

  return { value, breakdown };
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
