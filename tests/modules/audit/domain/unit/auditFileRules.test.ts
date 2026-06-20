import { describe, expect, it } from "vitest";

import type { AuditFinding } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { aggregateFileRules } from "../../../../../app/modules/audit/domain/services/auditFileRules.js";

function finding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    category: "database",
    rule: "raw-sql-outside-infrastructure",
    severity: "medium",
    source: "native",
    module: "",
    class: null,
    file: "/root/admin/X.php",
    line: 1,
    message: "x",
    details: {},
    ...overrides,
  };
}

describe("aggregateFileRules", () => {
  it("agrupa por regla con conteo, category, bySeverity, risk y la lista de hallazgos (line/severity/message)", () => {
    const groups = aggregateFileRules([
      finding({ rule: "raw-sql-outside-infrastructure", category: "database", severity: "medium", line: 10, message: "sql A" }),
      finding({ rule: "raw-sql-outside-infrastructure", category: "database", severity: "medium", line: 20, message: "sql B" }),
      finding({ rule: "sql-concatenation", category: "security", severity: "high", line: 5, message: "inj" }),
    ]);

    expect(groups).toEqual([
      {
        rule: "raw-sql-outside-infrastructure",
        category: "database",
        findingsCount: 2,
        bySeverity: { medium: 2 },
        risk: 4,
        findings: [
          { line: 10, severity: "medium", message: "sql A" },
          { line: 20, severity: "medium", message: "sql B" },
        ],
      },
      {
        rule: "sql-concatenation",
        category: "security",
        findingsCount: 1,
        bySeverity: { high: 1 },
        risk: 3,
        findings: [{ line: 5, severity: "high", message: "inj" }],
      },
    ]);
  });

  it("ordena de mayor a menor risk", () => {
    const groups = aggregateFileRules([
      finding({ rule: "a", severity: "low" }),
      finding({ rule: "b", severity: "critical" }),
      finding({ rule: "c", severity: "medium" }),
    ]);

    expect(groups.map((group) => group.rule)).toEqual(["b", "c", "a"]);
  });

  it("una lista vacia produce una lista vacia", () => {
    expect(aggregateFileRules([])).toEqual([]);
  });
});
