import { jsComponentsOf } from "../../domain/services/jsComponents.js";
import { jsFinding } from "./jsFinding.js";
const ABSOLUTE_URL_PATTERN = /^https?:\/\//;
export function jsApiAnalyzer(files) {
    const filesByEndpoint = endpointFileCounts(files);
    return files.flatMap((file) => {
        const hasComponents = jsComponentsOf(file).length > 0;
        return file.httpCalls.flatMap((call) => {
            const findings = [];
            const endpointFiles = filesByEndpoint.get(call.endpoint) ?? 0;
            if (hasComponents) {
                findings.push(build(file.file, call, "http-in-component", "medium", `Llamada HTTP (${call.client}) dentro de un archivo de componentes: la UI conoce la API directamente.`));
            }
            // String(null) = "null": nunca parece una URL absoluta.
            if (ABSOLUTE_URL_PATTERN.test(String(call.endpoint))) {
                findings.push(build(file.file, call, "hardcoded-api-url", "medium", `URL de API hardcodeada (${call.endpoint}): deberia salir de configuracion por entorno.`));
            }
            if (endpointFiles > 1) {
                findings.push(build(file.file, call, "duplicate-endpoint", "low", `El endpoint "${call.endpoint}" se llama desde ${endpointFiles} archivos: la integracion esta duplicada.`, {
                    files: endpointFiles,
                }));
            }
            return findings;
        });
    });
}
// Cantidad de archivos distintos que llaman a cada endpoint conocido (los `null` no se cuentan).
function endpointFileCounts(files) {
    const counts = new Map();
    for (const file of files) {
        const endpoints = new Set(file.httpCalls.map((call) => call.endpoint).filter((endpoint) => endpoint !== null));
        for (const endpoint of endpoints) {
            counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
        }
    }
    return counts;
}
function build(file, call, rule, severity, message, extra = {}) {
    return jsFinding({
        category: "api_access",
        rule,
        severity,
        class: null,
        file,
        line: call.line,
        message,
        details: { client: call.client, endpoint: call.endpoint, ...extra },
    });
}
