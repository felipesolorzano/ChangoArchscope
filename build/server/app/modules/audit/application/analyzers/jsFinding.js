// Campos comunes a todos los findings nativos de JS: el modulo se deriva despues desde la ruta.
export function jsFinding(finding) {
    return {
        category: finding.category,
        rule: finding.rule,
        severity: finding.severity,
        source: "native",
        module: "",
        class: finding.class,
        file: finding.file,
        line: finding.line,
        message: finding.message,
        details: finding.details,
    };
}
