export type ProtectionLevel = "none" | "low" | "medium" | "high";

export type CoverageCount = { covered: number; total: number };
export type MutantCount = { killed: number; survived: number; timeout: number; noCoverage: number };
export type E2eCount = { passed: number; failed: number };

export type ProtectionBaseline = {
  root: string;
  tests: { testFiles: number; sourceFiles: number };
  coverage: (CoverageCount & { percent: number; reports: string[] }) | null;
  mutation: (MutantCount & { score: number; reports: string[] }) | null;
  e2e: (E2eCount & { reports: string[] }) | null;
  level: ProtectionLevel;
};
