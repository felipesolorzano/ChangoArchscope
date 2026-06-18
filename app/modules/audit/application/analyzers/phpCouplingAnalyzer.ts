import type { PhpFileStructure, PhpMethodStructure } from "../../domain/value-objects/PhpFileStructure.js";
import type { AuditFinding } from "../../domain/value-objects/AuditSnapshot.js";

export type PhpCouplingThresholds = {
  directInstantiations: number;
  staticCalls: number;
};

const DEFAULT_THRESHOLDS: PhpCouplingThresholds = {
  directInstantiations: 3,
  staticCalls: 3,
};

type PhpCouplingRule = "direct-instantiation" | "static-coupling" | "singleton-dependency" | "global-state-access";

export function phpCouplingAnalyzer(
  files: PhpFileStructure[],
  thresholds: PhpCouplingThresholds = DEFAULT_THRESHOLDS,
): AuditFinding[] {
  return files.flatMap((file) => analyzeFile(file, thresholds));
}

function analyzeFile(file: PhpFileStructure, thresholds: PhpCouplingThresholds): AuditFinding[] {
  return [
    ...file.classes.flatMap((classStructure) =>
      classStructure.methods.flatMap((method) => methodFindings(file.file, classStructure.name, method, thresholds)),
    ),
    ...file.functions.flatMap((method) => methodFindings(file.file, null, method, thresholds)),
  ];
}

function methodFindings(
  file: string,
  className: string | null,
  method: PhpMethodStructure,
  thresholds: PhpCouplingThresholds,
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (method.directInstantiationsCount > thresholds.directInstantiations) {
    findings.push(
      buildFinding(file, className, method.startLine, "direct-instantiation", {
        directInstantiationsCount: method.directInstantiationsCount,
      }),
    );
  }

  if (method.staticCallsCount > thresholds.staticCalls) {
    findings.push(
      buildFinding(file, className, method.startLine, "static-coupling", { staticCallsCount: method.staticCallsCount }),
    );
  }

  if (method.singletonAccessCount > 0) {
    findings.push(
      buildFinding(file, className, method.startLine, "singleton-dependency", {
        singletonAccessCount: method.singletonAccessCount,
      }),
    );
  }

  if (method.globalAccessCount > 0) {
    findings.push(
      buildFinding(file, className, method.startLine, "global-state-access", { globalAccessCount: method.globalAccessCount }),
    );
  }

  return findings;
}

function buildFinding(
  file: string,
  className: string | null,
  line: number,
  rule: PhpCouplingRule,
  details: Record<string, unknown>,
): AuditFinding {
  return {
    category: "coupling_low_level",
    rule,
    severity: "medium",
    source: "native",
    module: "",
    class: className,
    file,
    line,
    message: couplingMessage(rule, details),
    details,
  };
}

function couplingMessage(rule: PhpCouplingRule, details: Record<string, unknown>): string {
  switch (rule) {
    case "direct-instantiation":
      return `Metodo con ${details.directInstantiationsCount} instanciaciones directas, supera el umbral configurado.`;
    case "static-coupling":
      return `Metodo con ${details.staticCallsCount} llamadas estaticas, supera el umbral configurado.`;
    case "singleton-dependency":
      return "Metodo depende de un singleton via ::getInstance().";
    case "global-state-access":
      return "Metodo accede a estado global (global o variable superglobal).";
  }
}
