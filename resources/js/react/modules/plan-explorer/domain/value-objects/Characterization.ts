export type CharacterizationTargetKind = "page" | "component" | "php";
export type CharacterizationSkeletonKind = "rtl" | "msw" | "playwright" | "phpunit";

export interface CharacterizationSkeleton {
  kind: CharacterizationSkeletonKind;
  path: string;
  content: string;
}

export interface CharacterizationTarget {
  file: string;
  kind: CharacterizationTargetKind;
  score: number;
  risk: number;
  importers: number;
  untested: { name: string; complexity: number | null }[];
  endpoints: string[];
  skeletons: CharacterizationSkeleton[];
}

/** Respuesta de /characterization.json (ver app/modules/characterization/specs/characterization-targets.md). */
export interface CharacterizationPlan {
  targets: CharacterizationTarget[];
}
