export function phpDatabaseAnalyzer(files) {
    const duplicatedValues = findDuplicatedValues(files);
    return files.flatMap((file) => fileFindings(file, duplicatedValues));
}
function findDuplicatedValues(files) {
    const counts = new Map();
    for (const file of files) {
        for (const literal of file.sqlLiterals) {
            counts.set(literal.value, (counts.get(literal.value) ?? 0) + 1);
        }
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
}
function fileFindings(file, duplicatedValues) {
    const isInfrastructure = file.file.toLowerCase().includes("infrastructure");
    return file.sqlLiterals.flatMap((literal) => {
        const findings = [];
        if (literal.insideLoop) {
            findings.push(buildFinding(file.file, literal, "n-plus-one-query", "high"));
        }
        if (!isInfrastructure) {
            findings.push(buildFinding(file.file, literal, "raw-sql-outside-infrastructure", "medium"));
        }
        if (duplicatedValues.has(literal.value)) {
            findings.push(buildFinding(file.file, literal, "duplicate-sql", "low"));
        }
        return findings;
    });
}
function buildFinding(file, literal, rule, severity) {
    return {
        category: "database",
        rule,
        severity,
        source: "native",
        module: "",
        class: null,
        file,
        line: literal.line,
        message: databaseMessage(rule),
        details: { value: literal.value },
    };
}
function databaseMessage(rule) {
    switch (rule) {
        case "n-plus-one-query":
            return "Query SQL dentro de un loop: posible problema de N+1. Verificar antes de optimizar.";
        case "raw-sql-outside-infrastructure":
            return "SQL crudo fuera de la capa de infraestructura. Verificar antes de mover.";
        case "duplicate-sql":
            return "Este SQL aparece repetido en el codigo escaneado. Verificar antes de unificar.";
    }
}
