import type { AuditFinding } from "../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";

export function finding(rule: string, file: string, overrides: Partial<AuditFinding> = {}): AuditFinding {
  return { category: "x", rule, severity: "medium", source: "native", module: "", class: null, file, line: 1, message: "", details: {}, ...overrides };
}

/** Hallazgo `legacy_api` de un patron. */
export function legacy(pattern: string, file: string, details: Record<string, unknown> = {}): AuditFinding {
  return finding("x", file, { category: "legacy_api", details: { pattern, ...details } });
}
