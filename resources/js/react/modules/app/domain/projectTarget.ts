export type ProjectTarget = "laravel" | "react";

export type MapKind = "migration" | "design";

export function parseProjectTarget(value: string | null | undefined): ProjectTarget {
  return value === "react" ? "react" : "laravel";
}

export function targetFromSearch(search: string): ProjectTarget {
  return parseProjectTarget(new URLSearchParams(search).get("target"));
}

export function searchWithTarget(search: string, target: ProjectTarget): string {
  const params = new URLSearchParams(search);
  params.set("target", target);
  return `?${params.toString()}`;
}

// Laravel conserva sus targets historicos (`laravel`, `design`) para no perder mapas ya
// persistidos; React usa los suyos.
const MAP_TARGETS: Record<ProjectTarget, Record<MapKind, string>> = {
  laravel: { migration: "laravel", design: "design" },
  react: { migration: "react", design: "react-design" },
};

export function mapTargetFor(target: ProjectTarget, kind: MapKind): string {
  return MAP_TARGETS[target][kind];
}
