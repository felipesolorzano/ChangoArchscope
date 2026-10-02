export type CharacterizationStack = "laravel" | "react";

export type TargetKind = "page" | "component" | "php";

/** `exportedAs` (solo react): "default", el nombre exportado o null si el archivo no lo exporta. */
export type UntestedUnit = { name: string; complexity: number | null; exportedAs?: string | null };

/** Archivo a proteger con tests de caracterizacion antes de refactorizar (XRay X4). */
export type CharacterizationTarget = {
  file: string;
  kind: TargetKind;
  score: number;
  risk: number;
  importers: number;
  untested: UntestedUnit[];
  endpoints: string[];
};

export type SkeletonKind = "rtl" | "msw" | "playwright" | "phpunit";

export type TestSkeleton = { kind: SkeletonKind; path: string; content: string };
