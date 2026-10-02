import type { AuditFinding, AuditFindingSeverity } from "../../domain/value-objects/AuditSnapshot.js";
import type { JsFileStructure, JsSecurityIssue } from "../../domain/value-objects/JsFileStructure.js";
import { jsFinding } from "./jsFinding.js";

const SEVERITY_BY_RULE: Record<JsSecurityIssue["rule"], AuditFindingSeverity> = {
  "eval-usage": "critical",
  "new-function": "critical",
  "dangerously-set-inner-html": "medium",
  "inner-html-assignment": "medium",
};

const MESSAGE_BY_RULE: Record<JsSecurityIssue["rule"], string> = {
  "eval-usage": "Uso de eval(): riesgo de ejecucion de codigo arbitrario.",
  "new-function": "Function()/new Function() compila codigo desde un string: riesgo de ejecucion de codigo arbitrario.",
  "dangerously-set-inner-html": "dangerouslySetInnerHTML inserta HTML sin escapar: riesgo de XSS si el contenido no es confiable.",
  "inner-html-assignment": "Asignacion directa a innerHTML/outerHTML: riesgo de XSS y DOM fuera de React.",
};

export function jsSecurityAnalyzer(files: JsFileStructure[]): AuditFinding[] {
  return files.flatMap((file) =>
    file.securityIssues.map((issue) =>
      jsFinding({
        category: "security",
        rule: issue.rule,
        severity: SEVERITY_BY_RULE[issue.rule],
        class: null,
        file: file.file,
        line: issue.line,
        message: MESSAGE_BY_RULE[issue.rule],
        details: {},
      }),
    ),
  );
}
