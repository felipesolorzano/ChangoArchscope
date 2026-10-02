import type { PlanSignals } from "../value-objects/Plan.js";

// Que hallazgos respaldan una tarea: la regla y, opcionalmente, solo ciertas severidades.
export type TaskRuleSelector = {
  rule: string;
  severities?: string[];
};

// Puente entre el bounded context `plan` y los hallazgos concretos de `audit` (sin acoplar
// dominios). Es la UNICA fuente: de aca salen la metrica de la tarea y los hallazgos del panel.
export const TASK_RULES: Record<string, TaskRuleSelector[]> = {
  "close-sql-injections": [{ rule: "sql-concatenation" }],
  "close-code-injection": [{ rule: "eval-usage" }, { rule: "new-function" }],
  "close-xss-sinks": [{ rule: "dangerously-set-inner-html" }, { rule: "inner-html-assignment" }],
  "remove-manual-copies": [{ rule: "manual-copy-file" }],
  "remove-unused-files": [{ rule: "possibly-unused-file" }],
  "add-characterization-tests": [{ rule: "untested-complex-method" }],
  "add-component-tests": [{ rule: "untested-component", severities: ["high"] }],
  "reduce-n-plus-one": [{ rule: "n-plus-one-query" }],
  "extract-data-layer": [{ rule: "raw-sql-outside-infrastructure" }, { rule: "duplicate-sql" }],
  "break-god-classes": [{ rule: "large-class" }],
  "isolate-http-layer": [{ rule: "http-in-component" }, { rule: "duplicate-endpoint" }, { rule: "hardcoded-api-url" }],
  "remove-jquery": [{ rule: "jquery-usage" }, { rule: "direct-dom-access" }],
  "replace-base-class-inheritance": [{ rule: "base-class-inheritance" }],
  "split-large-components": [{ rule: "large-component" }, { rule: "long-render" }, { rule: "large-state" }],
};

// Tareas con fuentes de hallazgos especiales (no basadas en reglas de findings).
export const SKIPPED_FILES_TASK = "exclude-third-party";
export const DUPLICATE_FILES_TASK = "resolve-duplicate-migrations";

export function matchesSelectors(selectors: TaskRuleSelector[], rule: string, severity: string): boolean {
  return selectors.some((selector) => selector.rule === rule && (selector.severities?.includes(severity) ?? true));
}

// Cantidad de hallazgos (de las senales) que respaldan una tarea.
export function countSelected(signals: PlanSignals, selectors: TaskRuleSelector[]): number {
  let total = 0;

  for (const [rule, bySeverity] of Object.entries(signals.findingCounts)) {
    for (const [severity, count] of Object.entries(bySeverity)) {
      if (matchesSelectors(selectors, rule, severity)) {
        total += count;
      }
    }
  }

  return total;
}
