import type { AuditFinding } from "../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";

export function finding(rule: string, file: string, overrides: Partial<AuditFinding> = {}): AuditFinding {
  return { category: "x", rule, severity: "medium", source: "native", module: "", class: null, file, line: 1, message: "", details: {}, ...overrides };
}
