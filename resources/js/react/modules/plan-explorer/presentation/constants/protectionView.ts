import type { ProtectionBaseline, ProtectionLevel } from "../../domain/value-objects/Protection";

const LABELS: Record<ProtectionLevel, string> = { none: "Ninguna", low: "Baja", medium: "Media", high: "Alta" };
const COLORS: Record<ProtectionLevel, string> = { none: "#dc2626", low: "#ea580c", medium: "#ca8a04", high: "#16a34a" };

export function protectionLevelLabel(level: ProtectionLevel): string {
  return LABELS[level];
}

export function protectionLevelColor(level: ProtectionLevel): string {
  return COLORS[level];
}

// Partes de la franja "Red de seguridad": tests, cobertura, mutation y E2E.
export function protectionParts({ tests, coverage, mutation, e2e }: ProtectionBaseline): string[] {
  return [
    `${tests.testFiles} archivos de test · ${tests.sourceFiles} fuente`,
    coverage ? `Cobertura ${coverage.percent}%` : "Cobertura: sin reporte",
    mutation ? `Mutation ${mutation.score}%` : "Mutation: sin reporte",
    e2e ? `E2E ${e2e.passed}/${e2e.passed + e2e.failed}` : "E2E: sin reporte",
  ];
}
