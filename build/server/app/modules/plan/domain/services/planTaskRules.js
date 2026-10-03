// Puente entre el bounded context `plan` y los hallazgos concretos de `audit` (sin acoplar
// dominios). Es la UNICA fuente: de aca salen la metrica de la tarea y los hallazgos del panel.
export const TASK_RULES = {
    "close-sql-injections": [{ rule: "sql-concatenation" }],
    "close-code-injection": [{ rule: "eval-usage" }, { rule: "new-function" }],
    "close-xss-sinks": [{ rule: "dangerously-set-inner-html" }, { rule: "inner-html-assignment" }],
    "remove-manual-copies": [{ rule: "manual-copy-file" }],
    "remove-unused-files": [{ rule: "possibly-unused-file" }],
    "break-import-cycles": [{ rule: "import-cycle" }],
    "remove-unused-exports": [{ rule: "unused-export" }],
    "add-characterization-tests": [{ rule: "untested-complex-method" }],
    "add-component-tests": [{ rule: "untested-component", severities: ["high"] }],
    "reduce-n-plus-one": [{ rule: "n-plus-one-query" }],
    "extract-data-layer": [{ rule: "raw-sql-outside-infrastructure" }, { rule: "duplicate-sql" }],
    "break-god-classes": [{ rule: "large-class" }],
    "isolate-http-layer": [{ rule: "http-in-component" }, { rule: "duplicate-endpoint" }, { rule: "hardcoded-api-url" }],
    "remove-jquery": [{ rule: "jquery-usage" }, { rule: "direct-dom-access" }],
    "replace-base-class-inheritance": [{ rule: "base-class-inheritance" }],
    "split-large-components": [{ rule: "large-component" }, { rule: "long-render" }, { rule: "large-state" }],
    "apply-legacy-codemods": [{ rule: "unsafe-lifecycle" }, { rule: "find-dom-node" }, { rule: "string-ref" }, { rule: "removed-php-function" }],
    "migrate-deprecated-apis": [{ rule: "with-router" }, { rule: "deprecated-library" }, { rule: "deprecated-php-function" }],
    "apply-post-upgrade-codemods": [{ rule: "legacy-react-dom-api" }],
};
// Tareas con fuentes de hallazgos especiales (no basadas en reglas de findings).
export const SKIPPED_FILES_TASK = "exclude-third-party";
export const DUPLICATE_FILES_TASK = "resolve-duplicate-migrations";
export function matchesSelectors(selectors, rule, severity) {
    return selectors.some((selector) => selector.rule === rule && (selector.severities?.includes(severity) ?? true));
}
// Cantidad de hallazgos (de las senales) que respaldan una tarea.
export function countSelected(signals, selectors) {
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
