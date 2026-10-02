import { REACT_BASE_CLASSES } from "../../domain/services/jsComponents.js";
import { isJsEntryPoint } from "../../domain/services/jsEntryPoints.js";
import { jsFinding } from "./jsFinding.js";
const INFRASTRUCTURE_SEGMENT = "/infrastructure/";
// En orden de reporte. Agregado por archivo: un archivo legacy puede tener cientos de `$(...)`.
const GLOBAL_RULES = [
    {
        kind: "jquery",
        rule: "jquery-usage",
        severity: "medium",
        message: (count) => `Usa jQuery ${count} veces: manipula el DOM por fuera de React.`,
        browserGlobal: false,
    },
    {
        kind: "dom",
        rule: "direct-dom-access",
        severity: "medium",
        message: (count) => `Accede a document ${count} veces: acceso directo al DOM desde el componente.`,
        browserGlobal: true,
    },
    {
        kind: "window",
        rule: "global-window-access",
        severity: "low",
        message: (count) => `Accede a window ${count} veces: depende de estado global del navegador.`,
        browserGlobal: true,
    },
];
export function jsCouplingAnalyzer(files) {
    return files.flatMap((file) => [...globalAccessFindings(file), ...inheritanceFindings(file)]);
}
function globalAccessFindings(file) {
    const allowsBrowserGlobals = file.file.includes(INFRASTRUCTURE_SEGMENT) || isJsEntryPoint(file.file);
    return GLOBAL_RULES.flatMap(({ kind, rule, severity, message, browserGlobal }) => {
        const lines = file.globalAccesses.filter((access) => access.kind === kind).map((access) => access.line);
        if (lines.length === 0 || (browserGlobal && allowsBrowserGlobals))
            return [];
        return [
            jsFinding({
                category: "coupling_low_level",
                rule,
                severity,
                class: null,
                file: file.file,
                line: Math.min(...lines),
                message: message(lines.length),
                details: { count: lines.length },
            }),
        ];
    });
}
function inheritanceFindings(file) {
    return file.classes
        .filter((classStructure) => classStructure.extendsName !== null && !REACT_BASE_CLASSES.has(classStructure.extendsName))
        .map((classStructure) => jsFinding({
        category: "coupling_low_level",
        rule: "base-class-inheritance",
        severity: "medium",
        class: classStructure.name,
        file: file.file,
        line: classStructure.startLine,
        message: `La clase "${classStructure.name}" hereda de "${classStructure.extendsName}": comparte estado y comportamiento por herencia en vez de composicion.`,
        details: { base: classStructure.extendsName },
    }));
}
