import type { PhpFileStructure, PhpMethodStructure } from "../../domain/value-objects/PhpFileStructure.js";
import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";

export type PhpComplexityThresholds = {
  methodLines: number;
  classLines: number;
  parameters: number;
  cyclomaticComplexity: number;
};

const DEFAULT_THRESHOLDS: PhpComplexityThresholds = {
  methodLines: 30,
  classLines: 300,
  parameters: 5,
  cyclomaticComplexity: 10,
};

export function phpComplexityAnalyzer(
  files: PhpFileStructure[],
  thresholds: PhpComplexityThresholds = DEFAULT_THRESHOLDS,
): AuditFinding[] {
  return files.flatMap((file) => analyzeFile(file, thresholds));
}

function analyzeFile(file: PhpFileStructure, thresholds: PhpComplexityThresholds): AuditFinding[] {
  return [
    ...file.classes.flatMap((classStructure) => [
      ...classFindings(file.file, classStructure, thresholds),
      ...classStructure.methods.flatMap((method) => methodFindings(file.file, classStructure.name, method, thresholds)),
    ]),
    ...file.functions.flatMap((method) => methodFindings(file.file, null, method, thresholds)),
  ];
}

function classFindings(
  file: string,
  classStructure: PhpFileStructure["classes"][number],
  thresholds: PhpComplexityThresholds,
): AuditFinding[] {
  const lines = classStructure.endLine - classStructure.startLine + 1;

  if (lines <= thresholds.classLines) {
    return [];
  }

  return [
    buildFinding(file, classStructure.name, classStructure.startLine, "large-class", "medium", { lines }),
  ];
}

function methodFindings(
  file: string,
  className: string | null,
  method: PhpMethodStructure,
  thresholds: PhpComplexityThresholds,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const lines = method.endLine - method.startLine + 1;

  if (lines > thresholds.methodLines) {
    findings.push(buildFinding(file, className, method.startLine, "long-method", "medium", { lines }));
  }

  if (method.parametersCount > thresholds.parameters) {
    findings.push(
      buildFinding(file, className, method.startLine, "too-many-parameters", "medium", { parametersCount: method.parametersCount }),
    );
  }

  const cyclomaticComplexity = method.decisionPointsCount + 1;

  if (cyclomaticComplexity > thresholds.cyclomaticComplexity) {
    findings.push(
      buildFinding(file, className, method.startLine, "high-cyclomatic-complexity", "high", { cyclomaticComplexity }),
    );
  }

  return findings;
}

type PhpComplexityRule = "long-method" | "too-many-parameters" | "high-cyclomatic-complexity" | "large-class";

function buildFinding(
  file: string,
  className: string | null,
  line: number,
  rule: PhpComplexityRule,
  severity: AuditFinding["severity"],
  details: Record<string, unknown>,
): AuditFinding {
  return {
    category: "complexity",
    rule,
    severity,
    source: "native",
    module: "",
    class: className,
    file,
    line,
    message: complexityMessage(rule, details),
    details,
  };
}

function complexityMessage(rule: PhpComplexityRule, details: Record<string, unknown>): string {
  switch (rule) {
    case "long-method":
      return `Metodo con ${details.lines} lineas, supera el umbral configurado.`;
    case "too-many-parameters":
      return `Metodo con ${details.parametersCount} parametros, supera el umbral configurado.`;
    case "high-cyclomatic-complexity":
      return `Complejidad ciclomatica ${details.cyclomaticComplexity}, supera el umbral configurado.`;
    case "large-class":
      return `Clase con ${details.lines} lineas, supera el umbral configurado.`;
  }
}
