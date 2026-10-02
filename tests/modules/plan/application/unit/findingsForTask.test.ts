import { describe, expect, it } from "vitest";

import type { AuditFinding, AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { findingsForTask } from "../../../../../app/modules/plan/application/use-cases/findingsForTask.js";

function finding(over: Partial<AuditFinding>): AuditFinding {
  return { category: "x", rule: "r", severity: "medium", source: "native", module: "", class: null, file: "/r/F.php", line: 1, message: "m", details: {}, ...over };
}

function snapshot(): AuditSnapshot {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: "laravel",
    module: null,
    summary: { files_scanned: 1, files_skipped: 1, modules: 0, findings_count: 4, by_category: {}, by_severity: {} },
    findings: [
      finding({ rule: "sql-concatenation", severity: "high", file: "/r/a/A.php", line: 10, message: "inj A" }),
      finding({ rule: "sql-concatenation", severity: "high", file: "/r/a/B.php", line: 20, message: "inj B" }),
      finding({ rule: "raw-sql-outside-infrastructure", severity: "medium", file: "/r/a/C.php", line: 5, message: "raw" }),
      finding({ rule: "large-class", severity: "low", file: "/r/a/D.php", line: 1, message: "big" }),
    ],
    riskScore: { value: 1, breakdown: {} },
    riskBreakdown: {
      byFile: [
        { key: "/r/a/Trafic.lib.inc", value: 1, byCategory: {}, bySeverity: {}, findingsCount: 1 },
        { key: "/r/a/Trafic_new.lib.inc", value: 1, byCategory: {}, bySeverity: {}, findingsCount: 1 },
      ],
      byClass: [],
      byModule: [],
      topRiskiestFiles: [],
    },
    skippedFiles: [{ file: "/r/vendor/excel.php", error: "Parse Error : unexpected token" }],
  };
}

describe("findingsForTask", () => {
  it("una tarea basada en reglas devuelve los findings de esas reglas (file/line/rule/severity/message)", () => {
    const result = findingsForTask(snapshot(), "close-sql-injections");

    expect(result.taskKey).toBe("close-sql-injections");
    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      { file: "/r/a/A.php", line: 10, rule: "sql-concatenation", severity: "high", message: "inj A" },
      { file: "/r/a/B.php", line: 20, rule: "sql-concatenation", severity: "high", message: "inj B" },
    ]);
  });

  it("extract-data-layer agrupa varias reglas (raw-sql + duplicate-sql)", () => {
    const result = findingsForTask(snapshot(), "extract-data-layer");

    expect(result.items.map((item) => item.rule)).toEqual(["raw-sql-outside-infrastructure"]);
  });

  it("exclude-third-party devuelve los archivos no parseables como items", () => {
    const result = findingsForTask(snapshot(), "exclude-third-party");

    expect(result.items).toEqual([
      { file: "/r/vendor/excel.php", line: 0, rule: "parse-error", severity: "info", message: "Parse Error : unexpected token" },
    ]);
  });

  it("resolve-duplicate-migrations devuelve los archivos _new con su original", () => {
    const result = findingsForTask(snapshot(), "resolve-duplicate-migrations");

    expect(result.items).toEqual([
      { file: "/r/a/Trafic_new.lib.inc", line: 0, rule: "duplicate-file", severity: "medium", message: "Duplicado de Trafic.lib.inc" },
    ]);
  });

  it("respeta el filtro por severidad del selector (add-component-tests: solo high)", () => {
    const base = snapshot();
    const result = findingsForTask(
      {
        ...base,
        findings: [
          finding({ rule: "untested-component", severity: "high", file: "/r/A.js", line: 3, message: "A" }),
          finding({ rule: "untested-component", severity: "medium", file: "/r/B.js", line: 4, message: "B" }),
        ],
      },
      "add-component-tests",
    );

    expect(result).toEqual({
      taskKey: "add-component-tests",
      total: 1,
      items: [{ file: "/r/A.js", line: 3, rule: "untested-component", severity: "high", message: "A" }],
    });
  });

  it("una tarea React con varias reglas devuelve las de todas, en el orden del snapshot", () => {
    const base = snapshot();
    const result = findingsForTask(
      {
        ...base,
        findings: [
          finding({ rule: "jquery-usage", file: "/r/A.js" }),
          finding({ rule: "http-in-component", file: "/r/B.js" }),
          finding({ rule: "direct-dom-access", file: "/r/C.js" }),
        ],
      },
      "remove-jquery",
    );

    expect(result.items.map((item) => item.file)).toEqual(["/r/A.js", "/r/C.js"]);
  });

  it("limita a 100 items pero total cuenta todos", () => {
    const base = snapshot();
    const findings = Array.from({ length: 120 }, (_, index) => finding({ rule: "jquery-usage", line: index }));

    const result = findingsForTask({ ...base, findings }, "remove-jquery");

    expect(result.total).toBe(120);
    expect(result.items).toHaveLength(100);
    expect(result.items[99].line).toBe(99);
  });

  it("una tarea sin fuente de hallazgos devuelve lista vacia", () => {
    expect(findingsForTask(snapshot(), "validate-risk-reduction")).toEqual({ taskKey: "validate-risk-reduction", total: 0, items: [] });
  });
});
