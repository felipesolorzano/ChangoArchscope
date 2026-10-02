export type ProtectionLevel = "none" | "low" | "medium" | "high";

/** Respuesta de /protection.json (ver app/modules/protection/specs/protection-baseline.md). */
export interface ProtectionBaseline {
  root: string;
  tests: { testFiles: number; sourceFiles: number };
  coverage: { percent: number; covered: number; total: number; reports: string[] } | null;
  mutation: { score: number; killed: number; survived: number; timeout: number; noCoverage: number; reports: string[] } | null;
  e2e: { passed: number; failed: number; reports: string[] } | null;
  level: ProtectionLevel;
}
