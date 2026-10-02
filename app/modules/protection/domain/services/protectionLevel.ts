import type { ProtectionLevel } from "../value-objects/Protection.js";

export type ProtectionSignals = { testFiles: number; coverage: number | null; mutation: number | null; reports: number };

// none: ni tests ni reportes; high: cobertura >= 80 y mutation >= 70; medium: alguna >= 50; si no low.
export function protectionLevel({ testFiles, coverage, mutation, reports }: ProtectionSignals): ProtectionLevel {
  if (testFiles === 0 && reports === 0) {
    return "none";
  }
  if ((coverage ?? 0) >= 80 && (mutation ?? 0) >= 70) {
    return "high";
  }
  if ((coverage ?? 0) >= 50 || (mutation ?? 0) >= 50) {
    return "medium";
  }
  return "low";
}
