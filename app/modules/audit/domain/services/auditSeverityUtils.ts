import type { AuditFindingSeverity, AuditSnapshot } from "../value-objects/AuditSnapshot.js";

// Stryker disable next-line StringLiteral: "low" en rango 0 y "no encontrado" (-1) comparan igual con >=, mutante equivalente.
const SEVERITY_ORDER: AuditFindingSeverity[] = ["low", "medium", "high", "critical"];

export function exceedsSeverityThreshold(snapshot: AuditSnapshot, threshold: AuditFindingSeverity): boolean {
  const thresholdRank = SEVERITY_ORDER.indexOf(threshold);

  return snapshot.findings.some((finding) => SEVERITY_ORDER.indexOf(finding.severity) >= thresholdRank);
}
