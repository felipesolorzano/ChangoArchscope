import type { CodemodCandidate } from "../../domain/value-objects/Codemod";

const plural = (count: number, singular: string, many: string) => `${count} ${count === 1 ? singular : many}`;

export function codemodToolLabel(candidate: CodemodCandidate): string {
  return candidate.tool === null ? "Manual" : `Automatico · ${candidate.tool}`;
}

export function codemodSummary(candidate: CodemodCandidate): string {
  const files = candidate.files.length;
  return `${plural(files, "archivo", "archivos")} · ${plural(candidate.occurrences, "ocurrencia", "ocurrencias")} · ${candidate.protectedFiles}/${files} con tests`;
}

/** Sin tests, un codemod puede romper sin que nadie se entere: primero caracterizar (X4). */
export function codemodWarning(candidate: CodemodCandidate): string | null {
  const unprotected = candidate.files.length - candidate.protectedFiles;
  return unprotected > 0 ? `Caracterizar antes: ${plural(unprotected, "archivo", "archivos")} sin tests` : null;
}

/** XRay X6: lo que tiene reemplazo en la version actual se migra antes de subir versiones. */
export function codemodTimingLabel(candidate: CodemodCandidate): string {
  return candidate.timing === "before-upgrade" ? "Antes de actualizar" : "Despues de actualizar";
}
