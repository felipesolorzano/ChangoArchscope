import path from "node:path";

import type { AuditFinding, AuditRiskBreakdown, RiskEntry } from "../value-objects/AuditSnapshot.js";
import { SEVERITY_WEIGHTS } from "./auditSeverityWeights.js";

const TOP_RISKIEST_FILES_LIMIT = 20;

export function buildRiskBreakdown(findings: AuditFinding[], sourceRoot?: string): AuditRiskBreakdown {
  const byFile = buildEntries(findings, (finding) => finding.file);
  const byClass = buildEntries(
    findings.filter((finding) => finding.class !== null),
    (finding) => `${finding.file}#${finding.class}`,
  );
  const byModule = buildEntries(
    findings.filter((finding) => moduleOf(finding, sourceRoot) !== null),
    (finding) => moduleOf(finding, sourceRoot) as string,
  );

  return {
    byFile,
    byClass,
    byModule,
    topRiskiestFiles: byFile.slice(0, TOP_RISKIEST_FILES_LIMIT),
  };
}

function moduleOf(finding: AuditFinding, sourceRoot: string | undefined): string | null {
  if (finding.module !== "") {
    return finding.module;
  }

  if (sourceRoot === undefined) {
    return null;
  }

  const [firstSegment] = path.relative(sourceRoot, finding.file).split(path.sep);

  return firstSegment ?? null;
}

function buildEntries(findings: AuditFinding[], keyFn: (finding: AuditFinding) => string): RiskEntry[] {
  const entries = new Map<string, RiskEntry>();

  for (const finding of findings) {
    const key = keyFn(finding);
    const weight = SEVERITY_WEIGHTS[finding.severity];
    const entry: RiskEntry = entries.get(key) ?? { key, value: 0, byCategory: {}, bySeverity: {}, findingsCount: 0 };

    entry.value += weight;
    entry.byCategory[finding.category] = (entry.byCategory[finding.category] ?? 0) + weight;
    entry.bySeverity[finding.severity] = (entry.bySeverity[finding.severity] ?? 0) + 1;
    entry.findingsCount += 1;

    entries.set(key, entry);
  }

  return [...entries.values()].sort((a, b) => b.value - a.value);
}
