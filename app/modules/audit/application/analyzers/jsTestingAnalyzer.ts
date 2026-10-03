import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";
import type { JsExport, JsFileStructure } from "../../domain/value-objects/JsFileStructure.js";
import { jsComponentsOf } from "../../domain/services/jsComponents.js";
import { isJsTestFile, jsTestImporters } from "../../domain/services/jsTestImporters.js";
import { jsFinding } from "./jsFinding.js";

const HIGH_RISK_COMPLEXITY = 10;

export function jsTestingAnalyzer(files: JsFileStructure[]): AuditFinding[] {
  const tested = new Set(Object.keys(jsTestImporters(files)));

  return files
    .filter((file) => !isJsTestFile(file.file) && !tested.has(file.file))
    .flatMap((file) =>
      jsComponentsOf(file).map((component) =>
        jsFinding({
          category: "testing",
          rule: "untested-component",
          severity: component.cyclomaticComplexity > HIGH_RISK_COMPLEXITY ? "high" : "medium",
          class: component.name,
          file: file.file,
          line: component.startLine,
          message: `El componente "${component.name}" no tiene evidencia de test.`,
          details: { name: component.name, cyclomaticComplexity: component.cyclomaticComplexity, exportedAs: exportedAs(component.name, file.exports) },
        }),
      ),
    );
}

// Como se importa el componente desde un test: por defecto, con su nombre, o no se exporta (null).
function exportedAs(name: string, exports: JsExport[]): string | null {
  // Solo el `export default` trae `local`.
  if (name === "default" || exports.some((entry) => entry.local === name)) {
    return "default";
  }
  return exports.some((entry) => entry.name === name) ? name : null;
}
