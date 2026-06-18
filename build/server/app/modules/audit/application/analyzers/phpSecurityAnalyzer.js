const SEVERITY_BY_RULE = {
    "eval-usage": "critical",
    "dynamic-include": "high",
    "sql-concatenation": "high",
    "unsanitized-output": "medium",
};
const MESSAGE_BY_RULE = {
    "eval-usage": "Uso de eval(): riesgo de ejecucion de codigo arbitrario.",
    "dynamic-include": "include/require con ruta dinamica: riesgo de inclusion de archivo no controlada.",
    "sql-concatenation": "Concatenacion de SQL con datos dinamicos: riesgo de inyeccion SQL.",
    "unsanitized-output": "Salida directa de input de usuario sin pasar por ninguna funcion: riesgo de XSS.",
};
export function phpSecurityAnalyzer(files) {
    return files.flatMap((file) => file.securityIssues.map((issue) => buildFinding(file.file, issue)));
}
function buildFinding(file, issue) {
    return {
        category: "security",
        rule: issue.rule,
        severity: SEVERITY_BY_RULE[issue.rule],
        source: "native",
        module: "",
        class: null,
        file,
        line: issue.line,
        message: MESSAGE_BY_RULE[issue.rule],
        details: {},
    };
}
