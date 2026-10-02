import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";
import type { JsFileStructure } from "../../domain/value-objects/JsFileStructure.js";
import { jsComponentsOf } from "../../domain/services/jsComponents.js";
import { resolveJsImport } from "../../domain/services/jsImportResolution.js";
import { jsFinding } from "./jsFinding.js";

const TEST_FILE_PATTERN = /\.(?:test|spec)\.|\/__tests__\//;
const HIGH_RISK_COMPLEXITY = 10;

export function jsTestingAnalyzer(files: JsFileStructure[]): AuditFinding[] {
  const tested = testedFiles(files);

  return files
    .filter((file) => !TEST_FILE_PATTERN.test(file.file) && !tested.has(file.file))
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
          details: { name: component.name, cyclomaticComplexity: component.cyclomaticComplexity },
        }),
      ),
    );
}

// Archivos que algun test importa directamente.
function testedFiles(files: JsFileStructure[]): Set<string> {
  const known = new Set(files.map((file) => file.file));
  const tested = new Set<string>();

  for (const file of files.filter((candidate) => TEST_FILE_PATTERN.test(candidate.file))) {
    for (const importRef of file.imports) {
      resolveJsImport(file.file, importRef.source, known).forEach((target) => tested.add(target));
    }
  }

  return tested;
}
