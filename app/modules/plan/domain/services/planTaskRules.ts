// Mapea cada tarea del plan a las reglas de auditoria que la respaldan. Es el puente entre
// el bounded context `plan` y los hallazgos concretos de `audit` (sin acoplar dominios).
export const TASK_RULES: Record<string, string[]> = {
  "close-sql-injections": ["sql-concatenation"],
  "add-characterization-tests": ["untested-complex-method"],
  "reduce-n-plus-one": ["n-plus-one-query"],
  "extract-data-layer": ["raw-sql-outside-infrastructure", "duplicate-sql"],
  "break-god-classes": ["large-class"],
};

// Tareas con fuentes de hallazgos especiales (no basadas en reglas de findings).
export const SKIPPED_FILES_TASK = "exclude-third-party";
export const DUPLICATE_FILES_TASK = "resolve-duplicate-migrations";
