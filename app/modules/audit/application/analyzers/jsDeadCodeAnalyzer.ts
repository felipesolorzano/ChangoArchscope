import path from "node:path";

import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";
import type { JsFileStructure } from "../../domain/value-objects/JsFileStructure.js";
import { resolveJsImport } from "../../domain/services/jsImportResolution.js";
import { jsFinding } from "./jsFinding.js";

// Marca de copia manual al final del nombre (sin extension), con o sin " (N)": "x - copia (4)",
// "x copy 2", "x_old", "x.devel", "x.bak".
const MANUAL_COPY_PATTERN = /(?: - cop(?:y|ia)| cop(?:y|ia)(?: \d+)?|_cop(?:y|ia)|_old|\.devel|\.bak)(?: \(\d+\))?$/i;
const ENTRY_POINT_NAME = "index";

export function jsDeadCodeAnalyzer(files: JsFileStructure[]): AuditFinding[] {
  const imported = importedFiles(files);

  return files.flatMap((file) => {
    const name = path.posix.basename(file.file);
    const stem = path.posix.parse(name).name;
    const findings: AuditFinding[] = [];

    if (!imported.has(file.file) && stem !== ENTRY_POINT_NAME) {
      findings.push(build(file.file, "possibly-unused-file", name, `Ningun archivo escaneado importa "${name}". Verificar antes de eliminar.`));
    }
    if (MANUAL_COPY_PATTERN.test(stem)) {
      findings.push(build(file.file, "manual-copy-file", name, `"${name}" parece una copia manual de otro archivo. Verificar antes de eliminar.`));
    }
    return findings;
  });
}

// Archivos importados por OTRO archivo escaneado (un auto-import no cuenta).
function importedFiles(files: JsFileStructure[]): Set<string> {
  const known = new Set(files.map((file) => file.file));
  const imported = new Set<string>();

  for (const file of files) {
    for (const importRef of file.imports) {
      resolveJsImport(file.file, importRef.source, known)
        .filter((target) => target !== file.file)
        .forEach((target) => imported.add(target));
    }
  }

  return imported;
}

function build(file: string, rule: string, name: string, message: string): AuditFinding {
  return jsFinding({ category: "dead_code", rule, severity: "low", class: null, file, line: 1, message, details: { name } });
}
