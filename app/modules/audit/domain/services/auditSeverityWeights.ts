import type { AuditFindingSeverity } from "../value-objects/AuditSnapshot.js";

export const SEVERITY_WEIGHTS: Record<AuditFindingSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
