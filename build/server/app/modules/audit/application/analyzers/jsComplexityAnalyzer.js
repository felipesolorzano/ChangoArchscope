import { isComponentClass } from "../../domain/services/jsComponents.js";
import { jsFinding } from "./jsFinding.js";
// Calibrados contra un CRA legacy real: el JSX infla `render`, por eso tiene su propio umbral.
const DEFAULT_THRESHOLDS = {
    methodLines: 50,
    renderLines: 150,
    parameters: 5,
    cyclomaticComplexity: 10,
    componentLines: 300,
    classLines: 300,
    stateKeys: 10,
};
export function jsComplexityAnalyzer(files, thresholds = DEFAULT_THRESHOLDS) {
    return files.flatMap((file) => [
        ...file.classes.flatMap((classStructure) => classStructure.methods.flatMap((method) => functionFindings(file.file, classStructure.name, method, true, thresholds))),
        ...file.functions.flatMap((fn) => functionFindings(file.file, null, fn, false, thresholds)),
        ...file.classes.flatMap((classStructure) => {
            const findings = [];
            const lines = linesOf(classStructure);
            const isComponent = isComponentClass(classStructure);
            if (isComponent && lines > thresholds.componentLines) {
                findings.push(build(file.file, classStructure.name, classStructure.startLine, "large-component", { lines }));
            }
            if (!isComponent && lines > thresholds.classLines) {
                findings.push(build(file.file, classStructure.name, classStructure.startLine, "large-class", { lines }));
            }
            if (classStructure.stateKeysCount > thresholds.stateKeys) {
                findings.push(build(file.file, classStructure.name, classStructure.startLine, "large-state", { stateKeys: classStructure.stateKeysCount }));
            }
            return findings;
        }),
        ...file.functions
            .filter((fn) => fn.containsJsx && linesOf(fn) > thresholds.componentLines)
            .map((fn) => build(file.file, fn.name, fn.startLine, "large-component", { lines: linesOf(fn) })),
    ]);
}
function functionFindings(file, className, fn, isMethod, thresholds) {
    const findings = [];
    const lines = linesOf(fn);
    const isRender = isMethod && fn.name === "render";
    if (isRender && lines > thresholds.renderLines) {
        findings.push(build(file, className, fn.startLine, "long-render", { lines }));
    }
    if (!isRender && lines > thresholds.methodLines) {
        findings.push(build(file, className, fn.startLine, "long-method", { lines }));
    }
    if (fn.parametersCount > thresholds.parameters) {
        findings.push(build(file, className, fn.startLine, "too-many-parameters", { parametersCount: fn.parametersCount }));
    }
    const cyclomaticComplexity = fn.decisionPointsCount + 1;
    if (cyclomaticComplexity > thresholds.cyclomaticComplexity) {
        findings.push(build(file, className, fn.startLine, "high-cyclomatic-complexity", { cyclomaticComplexity }));
    }
    return findings;
}
function linesOf(span) {
    return span.endLine - span.startLine + 1;
}
function build(file, className, line, rule, details) {
    return jsFinding({
        category: "complexity",
        rule,
        severity: rule === "high-cyclomatic-complexity" ? "high" : "medium",
        class: className,
        file,
        line,
        message: messageFor(rule, details),
        details,
    });
}
function messageFor(rule, details) {
    switch (rule) {
        case "long-method":
            return `Funcion o metodo con ${details.lines} lineas, supera el umbral configurado.`;
        case "long-render":
            return `render() con ${details.lines} lineas, supera el umbral configurado.`;
        case "too-many-parameters":
            return `Funcion o metodo con ${details.parametersCount} parametros, supera el umbral configurado.`;
        case "high-cyclomatic-complexity":
            return `Complejidad ciclomatica ${details.cyclomaticComplexity}, supera el umbral configurado.`;
        case "large-component":
            return `Componente con ${details.lines} lineas, supera el umbral configurado.`;
        case "large-class":
            return `Clase con ${details.lines} lineas, supera el umbral configurado.`;
        case "large-state":
            return `Componente con ${details.stateKeys} claves de estado, supera el umbral configurado.`;
    }
}
