import type { CharacterizationSkeletonKind, CharacterizationTarget, CharacterizationTargetKind } from "../../domain/value-objects/Characterization";

const KIND_LABELS: Record<CharacterizationTargetKind, string> = { page: "Pagina", component: "Componente", php: "PHP" };
const SKELETON_LABELS: Record<CharacterizationSkeletonKind, string> = {
  rtl: "Test RTL",
  msw: "Handlers MSW",
  playwright: "Playwright",
  phpunit: "PHPUnit",
};
const SHOWN_NAMES = 3;

export function targetKindLabel(kind: CharacterizationTargetKind): string {
  return KIND_LABELS[kind];
}

export function skeletonLabel(kind: CharacterizationSkeletonKind): string {
  return SKELETON_LABELS[kind];
}

/** Por que conviene proteger este archivo: riesgo, uso, codigo sin test y endpoints. */
export function targetReasons(target: CharacterizationTarget): string[] {
  const reasons = [`riesgo ${target.risk}`];

  if (target.importers > 0) {
    reasons.push(`importado por ${target.importers}`);
  }

  if (target.untested.length > 0) {
    const names = target.untested.slice(0, SHOWN_NAMES).map((unit) => unit.name).join(", ");
    const rest = target.untested.length - SHOWN_NAMES;
    reasons.push(`${target.untested.length} sin test: ${names}${rest > 0 ? ` (+${rest})` : ""}`);
  }

  if (target.endpoints.length > 0) {
    reasons.push(`${target.endpoints.length} ${target.endpoints.length === 1 ? "endpoint" : "endpoints"}`);
  }

  return reasons;
}
