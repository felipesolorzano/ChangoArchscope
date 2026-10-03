export type CodemodFile = { file: string; occurrences: number; testedBy: string[] };

export type CodemodCandidate = {
  pattern: string;
  title: string;
  tool: string | null;
  command: string | null;
  note: string;
  files: CodemodFile[];
  occurrences: number;
  protectedFiles: number;
};

export type CodemodPlan = { candidates: CodemodCandidate[] };
