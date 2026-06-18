const DEFAULT_THRESHOLDS = {
    methodLines: 30,
    classLines: 300,
    parameters: 5,
    cyclomaticComplexity: 10,
};
export function phpComplexityAnalyzer(files, thresholds = DEFAULT_THRESHOLDS) {
    return files.flatMap((file) => analyzeFile(file, thresholds));
}
function analyzeFile(file, thresholds) {
    return [
        ...file.classes.flatMap((classStructure) => [
            ...classFindings(file.file, classStructure, thresholds),
            ...classStructure.methods.flatMap((method) => methodFindings(file.file, classStructure.name, method, thresholds)),
        ]),
        ...file.functions.flatMap((method) => methodFindings(file.file, null, method, thresholds)),
    ];
}
function classFindings(file, classStructure, thresholds) {
    const lines = classStructure.endLine - classStructure.startLine + 1;
    if (lines <= thresholds.classLines) {
        return [];
    }
    return [
        buildFinding(file, classStructure.name, classStructure.startLine, "large-class", "medium", { lines }),
    ];
}
function methodFindings(file, className, method, thresholds) {
    const findings = [];
    const lines = method.endLine - method.startLine + 1;
    if (lines > thresholds.methodLines) {
        findings.push(buildFinding(file, className, method.startLine, "long-method", "medium", { lines }));
    }
    if (method.parametersCount > thresholds.parameters) {
        findings.push(buildFinding(file, className, method.startLine, "too-many-parameters", "medium", { parametersCount: method.parametersCount }));
    }
    const cyclomaticComplexity = method.decisionPointsCount + 1;
    if (cyclomaticComplexity > thresholds.cyclomaticComplexity) {
        findings.push(buildFinding(file, className, method.startLine, "high-cyclomatic-complexity", "high", { cyclomaticComplexity }));
    }
    return findings;
}
function buildFinding(file, className, line, rule, severity, details) {
    return {
        category: "complexity",
        rule,
        severity,
        source: "native",
        module: "",
        class: className,
        file,
        line,
        message: complexityMessage(rule, details),
        details,
    };
}
function complexityMessage(rule, details) {
    switch (rule) {
        case "long-method":
            return `Metodo con ${details.lines} lineas, supera el umbral configurado.`;
        case "too-many-parameters":
            return `Metodo con ${details.parametersCount} parametros, supera el umbral configurado.`;
        case "high-cyclomatic-complexity":
            return `Complejidad ciclomatica ${details.cyclomaticComplexity}, supera el umbral configurado.`;
        case "large-class":
            return `Clase con ${details.lines} lineas, supera el umbral configurado.`;
    }
}
