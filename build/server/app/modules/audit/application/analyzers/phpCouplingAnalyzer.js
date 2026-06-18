const DEFAULT_THRESHOLDS = {
    directInstantiations: 3,
    staticCalls: 3,
};
export function phpCouplingAnalyzer(files, thresholds = DEFAULT_THRESHOLDS) {
    return files.flatMap((file) => analyzeFile(file, thresholds));
}
function analyzeFile(file, thresholds) {
    return [
        ...file.classes.flatMap((classStructure) => classStructure.methods.flatMap((method) => methodFindings(file.file, classStructure.name, method, thresholds))),
        ...file.functions.flatMap((method) => methodFindings(file.file, null, method, thresholds)),
    ];
}
function methodFindings(file, className, method, thresholds) {
    const findings = [];
    if (method.directInstantiationsCount > thresholds.directInstantiations) {
        findings.push(buildFinding(file, className, method.startLine, "direct-instantiation", {
            directInstantiationsCount: method.directInstantiationsCount,
        }));
    }
    if (method.staticCallsCount > thresholds.staticCalls) {
        findings.push(buildFinding(file, className, method.startLine, "static-coupling", { staticCallsCount: method.staticCallsCount }));
    }
    if (method.singletonAccessCount > 0) {
        findings.push(buildFinding(file, className, method.startLine, "singleton-dependency", {
            singletonAccessCount: method.singletonAccessCount,
        }));
    }
    if (method.globalAccessCount > 0) {
        findings.push(buildFinding(file, className, method.startLine, "global-state-access", { globalAccessCount: method.globalAccessCount }));
    }
    return findings;
}
function buildFinding(file, className, line, rule, details) {
    return {
        category: "coupling_low_level",
        rule,
        severity: "medium",
        source: "native",
        module: "",
        class: className,
        file,
        line,
        message: couplingMessage(rule, details),
        details,
    };
}
function couplingMessage(rule, details) {
    switch (rule) {
        case "direct-instantiation":
            return `Metodo con ${details.directInstantiationsCount} instanciaciones directas, supera el umbral configurado.`;
        case "static-coupling":
            return `Metodo con ${details.staticCallsCount} llamadas estaticas, supera el umbral configurado.`;
        case "singleton-dependency":
            return "Metodo depende de un singleton via ::getInstance().";
        case "global-state-access":
            return "Metodo accede a estado global (global o variable superglobal).";
    }
}
