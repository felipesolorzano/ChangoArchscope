import type { PhpFileStructure, PhpMethodStructure } from "../../domain/value-objects/PhpFileStructure.js";
import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";

type PhpDeadCodeRule = "possibly-unused-function" | "possibly-unused-class" | "possibly-unused-method";

export function phpDeadCodeAnalyzer(files: PhpFileStructure[]): AuditFinding[] {
  const referenced = new Set<string>();

  for (const file of files) {
    for (const name of file.referencedNames) {
      referenced.add(name);
    }
  }

  return files.flatMap((file) => fileFindings(file, referenced));
}

function fileFindings(file: PhpFileStructure, referenced: Set<string>): AuditFinding[] {
  const functionFindings = file.functions
    .filter((fn) => !isMagicMethod(fn.name) && !referenced.has(fn.name))
    .map((fn) => buildFinding(file.file, fn.startLine, "possibly-unused-function", fn.name, null));

  const classFindings = file.classes.flatMap((classStructure) => [
    ...(referenced.has(classStructure.name)
      ? []
      : [buildFinding(file.file, classStructure.startLine, "possibly-unused-class", classStructure.name, classStructure.name)]),
    ...classStructure.methods
      .filter((method) => !isMagicMethod(method.name) && !referenced.has(method.name))
      .map((method) => buildFinding(file.file, method.startLine, "possibly-unused-method", method.name, classStructure.name)),
  ]);

  return [...functionFindings, ...classFindings];
}

function isMagicMethod(name: PhpMethodStructure["name"]): boolean {
  return name.startsWith("__");
}

function buildFinding(
  file: string,
  line: number,
  rule: PhpDeadCodeRule,
  name: string,
  className: string | null,
): AuditFinding {
  return {
    category: "dead_code",
    rule,
    severity: "low",
    source: "native",
    module: "",
    class: className,
    file,
    line,
    message: deadCodeMessage(rule, name),
    details: { name },
  };
}

function deadCodeMessage(rule: PhpDeadCodeRule, name: string): string {
  switch (rule) {
    case "possibly-unused-function":
      return `La funcion "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
    case "possibly-unused-class":
      return `La clase "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
    case "possibly-unused-method":
      return `El metodo "${name}" no se referencia en los archivos escaneados. Verificar antes de eliminar.`;
  }
}
