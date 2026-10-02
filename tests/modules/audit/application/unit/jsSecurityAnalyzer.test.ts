import { describe, expect, it } from "vitest";

import { jsSecurityAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsSecurityAnalyzer.js";
import { jsFile } from "../../support/jsStructures.js";

describe("jsSecurityAnalyzer", () => {
  it.each([
    ["eval-usage", "critical", "Uso de eval(): riesgo de ejecucion de codigo arbitrario."],
    ["new-function", "critical", "Function()/new Function() compila codigo desde un string: riesgo de ejecucion de codigo arbitrario."],
    ["dangerously-set-inner-html", "medium", "dangerouslySetInnerHTML inserta HTML sin escapar: riesgo de XSS si el contenido no es confiable."],
    ["inner-html-assignment", "medium", "Asignacion directa a innerHTML/outerHTML: riesgo de XSS y DOM fuera de React."],
  ] as const)("%s -> %s", (rule, severity, message) => {
    const findings = jsSecurityAnalyzer([jsFile("/src/a.js", { securityIssues: [{ rule, line: 8 }] })]);

    expect(findings).toEqual([
      { category: "security", rule, severity, source: "native", module: "", class: null, file: "/src/a.js", line: 8, message, details: {} },
    ]);
  });

  it("un finding por issue, en orden", () => {
    const file = jsFile("/src/a.js", {
      securityIssues: [
        { rule: "eval-usage", line: 1 },
        { rule: "eval-usage", line: 4 },
      ],
    });

    expect(jsSecurityAnalyzer([file]).map((finding) => finding.line)).toEqual([1, 4]);
  });
});
