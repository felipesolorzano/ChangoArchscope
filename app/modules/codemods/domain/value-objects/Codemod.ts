export type CodemodStack = "laravel" | "react";

/** Como se moderniza un patron: herramienta y comando (nulos = migracion manual). */
export type CodemodRecipe = {
  stack: CodemodStack;
  title: string;
  tool: string | null;
  /** Puede traer `{paths}`: las rutas de los archivos afectados. */
  command: string | null;
  note: string;
};

export type CodemodFile = { file: string; occurrences: number; testedBy: string[] };

export type CodemodCandidate = Omit<CodemodRecipe, "stack"> & {
  pattern: string;
  files: CodemodFile[];
  occurrences: number;
  protectedFiles: number;
};
