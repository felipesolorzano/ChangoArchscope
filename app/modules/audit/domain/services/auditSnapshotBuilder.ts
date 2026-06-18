import type { AuditFinding, AuditSnapshot } from "../value-objects/AuditSnapshot.js";
import { buildRiskBreakdown } from "./auditRiskBreakdown.js";
import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";

export type AuditSnapshotContext = {
  target: string;
  module: string | null;
  filesScanned: number;
  modules: number;
  phpRoot?: string;
};

export function buildAuditSnapshot(findings: AuditFinding[], context: AuditSnapshotContext): AuditSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    target: context.target,
    module: context.module,
    summary: {
      files_scanned: context.filesScanned,
      modules: context.modules,
      findings_count: findings.length,
      by_category: countBy(findings, (finding) => finding.category),
      by_severity: countBy(findings, (finding) => finding.severity),
    },
    findings,
    riskScore: buildRiskScore(findings),
    riskBreakdown: buildRiskBreakdown(findings, context.phpRoot),
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
