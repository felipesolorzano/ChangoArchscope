import { describe, expect, it } from "vitest";

import type { PhpCompatibilityScanResult } from "../../../../../app/modules/audit/domain/repositories/PhpCompatibilityScanner.js";
import type { PhpCompatibilityIssue } from "../../../../../app/modules/audit/domain/value-objects/PhpCompatibilityIssue.js";
import { phpCompatibilityAnalyzer } from "../../../../../app/modules/audit/application/analyzers/phpCompatibilityAnalyzer.js";

function okScan(issues: PhpCompatibilityIssue[], targetPhp = "8.3"): PhpCompatibilityScanResult {
  return { status: "ok", targetPhp, issues };
}

const baseIssue: PhpCompatibilityIssue = {
  file: "app/Legacy/User.php",
  line: 120,
  rule: "PHPCompatibility.FunctionUse.RemovedFunctions.eachFound",
  severityRaw: "error",
  message: "Function each() is deprecated since PHP 7.2 and removed since PHP 8.0",
};

describe("phpCompatibilityAnalyzer", () => {
  it("convierte un issue 'error' en un finding high de categoria php_compatibility", () => {
    const findings = phpCompatibilityAnalyzer(okScan([baseIssue]));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "php_compatibility",
      rule: baseIssue.rule,
      severity: "high",
      source: "external",
      module: "",
      class: null,
      file: "app/Legacy/User.php",
      line: 120,
      message: baseIssue.message,
      details: { rule: baseIssue.rule, targetPhp: "8.3" },
    });
  });

  it("convierte un issue 'warning' en un finding medium", () => {
    const findings = phpCompatibilityAnalyzer(okScan([{ ...baseIssue, severityRaw: "warning" }]));

    expect(findings[0].severity).toBe("medium");
  });

  it("propaga el targetPhp del scan a details.targetPhp", () => {
    const findings = phpCompatibilityAnalyzer(okScan([baseIssue], "8.1"));

    expect(findings[0].details).toMatchObject({ targetPhp: "8.1" });
  });

  it("genera un finding por issue, en el mismo orden", () => {
    const findings = phpCompatibilityAnalyzer(
      okScan([
        { ...baseIssue, file: "A.php" },
        { ...baseIssue, file: "B.php", severityRaw: "warning" },
      ]),
    );

    expect(findings.map((finding) => finding.file)).toEqual(["A.php", "B.php"]);
    expect(findings.map((finding) => finding.severity)).toEqual(["high", "medium"]);
  });

  it("un scan ok sin issues no genera findings", () => {
    expect(phpCompatibilityAnalyzer(okScan([]))).toEqual([]);
  });

  it("un scan unavailable no genera findings y no lanza", () => {
    expect(phpCompatibilityAnalyzer({ status: "unavailable", reason: "Docker no esta disponible" })).toEqual([]);
  });
});
