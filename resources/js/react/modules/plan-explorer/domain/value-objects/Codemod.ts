export type CodemodFile = { file: string; occurrences: number; testedBy: string[] };

export type CodemodCandidate = {
  pattern: string;
  title: string;
  tool: string | null;
  command: string | null;
  note: string;
  /** XRay X6: antes o despues de subir versiones. */
  timing: "before-upgrade" | "after-upgrade";
  files: CodemodFile[];
  occurrences: number;
  protectedFiles: number;
};

export type CodemodPlan = { candidates: CodemodCandidate[] };
