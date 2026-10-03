import { isJsTestFile } from "../../domain/services/jsTestImporters.js";
import { jsFinding } from "./jsFinding.js";
const UNSAFE_LIFECYCLES = new Set(["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"]);
const ROUTER_SOURCES = new Set(["react-router", "react-router-dom"]);
const DEPRECATED_LIBRARIES = new Set(["moment", "request", "react-ga"]);
// APIs de React / librerias con reemplazo conocido (XRay X5): el insumo de los codemods.
export function jsLegacyApiAnalyzer(files) {
    return files
        .filter((file) => !isJsTestFile(file.file))
        .flatMap((file) => [...lifecycleFindings(file), ...file.legacyReactApis.map((usage) => reactApiFinding(file.file, usage)), ...withRouterFindings(file), ...libraryFindings(file)]);
}
function lifecycleFindings(file) {
    return file.classes.flatMap((klass) => klass.methods
        .filter((method) => UNSAFE_LIFECYCLES.has(method.name))
        .map((method) => legacyFinding({
        rule: "unsafe-lifecycle",
        severity: "medium",
        class: klass.name,
        file: file.file,
        line: method.startLine,
        message: `"${method.name}" esta deprecado (React 16.3+): migrar o renombrar a UNSAFE_${method.name}.`,
        details: { pattern: "unsafe-lifecycles", method: method.name },
    })));
}
function reactApiFinding(file, { api, line }) {
    if (api === "string-ref") {
        return legacyFinding({ rule: "string-ref", severity: "medium", class: null, file, line, message: "Las string refs no existen en React 19: usar createRef/useRef.", details: { pattern: "string-refs" } });
    }
    // findDOMNode tiene reemplazo en la version actual (refs); render/hydrate/unmount necesitan React 18.
    if (api === "findDOMNode") {
        return legacyFinding({ rule: "find-dom-node", severity: "medium", class: null, file, line, message: "findDOMNode no existe en React 19: usar una ref.", details: { pattern: "find-dom-node", api } });
    }
    return legacyFinding({ rule: "legacy-react-dom-api", severity: "medium", class: null, file, line, message: `ReactDOM.${api} no existe en React 19.`, details: { pattern: "react-dom-render", api } });
}
function withRouterFindings(file) {
    const usage = file.imports.find((importRef) => ROUTER_SOURCES.has(importRef.source) && importRef.names.includes("withRouter"));
    return usage === undefined
        ? []
        : [legacyFinding({ rule: "with-router", severity: "low", class: null, file: file.file, line: usage.line, message: "withRouter no existe en React Router v6: usar hooks.", details: { pattern: "with-router" } })];
}
// Uno por libreria, en la primera linea que la importa (las subrutas cuentan: `moment/locale/es`).
function libraryFindings(file) {
    const firstLine = new Map();
    for (const importRef of file.imports) {
        const library = importRef.source.split("/")[0];
        if (DEPRECATED_LIBRARIES.has(library) && !firstLine.has(library)) {
            firstLine.set(library, importRef.line);
        }
    }
    return [...firstLine].map(([library, line]) => legacyFinding({ rule: "deprecated-library", severity: "low", class: null, file: file.file, line, message: `"${library}" esta deprecada: reemplazarla.`, details: { pattern: `lib-${library}`, library } }));
}
function legacyFinding(finding) {
    return jsFinding({ category: "legacy_api", ...finding });
}
