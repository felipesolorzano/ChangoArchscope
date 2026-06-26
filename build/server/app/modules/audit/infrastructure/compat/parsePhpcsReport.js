const MOUNT_PREFIX = "/repo/";
/**
 * Normaliza el JSON de `phpcs --report=json` agrupado por archivo (ruta relativa, sin el
 * prefijo de montaje). Incluye archivos escaneados sin hallazgos como `[]`, lo que permite
 * al scan incremental registrar que un archivo paso a cero. Pura y defensiva.
 */
export function parsePhpcsReportByFile(raw) {
    const byFile = new Map();
    const files = raw?.files;
    if (files === null || typeof files !== "object")
        return byFile;
    for (const [absolutePath, fileReport] of Object.entries(files)) {
        const messages = fileReport?.messages;
        if (!Array.isArray(messages))
            continue;
        const file = stripMountPrefix(absolutePath);
        const issues = [];
        for (const raw of messages) {
            const issue = toIssue(file, raw);
            if (issue !== null)
                issues.push(issue);
        }
        byFile.set(file, issues);
    }
    return byFile;
}
/**
 * Lista plana de issues de compatibilidad. Aplana `parsePhpcsReportByFile` para tener una
 * sola fuente de verdad de la normalizacion.
 */
export function parsePhpcsReport(raw) {
    return [...parsePhpcsReportByFile(raw).values()].flat();
}
function toIssue(file, message) {
    const source = message.source;
    if (typeof source !== "string" || !source.startsWith("PHPCompatibility"))
        return null;
    return {
        file,
        line: typeof message.line === "number" ? message.line : 0,
        rule: source,
        severityRaw: message.type === "ERROR" ? "error" : "warning",
        message: typeof message.message === "string" ? message.message : "",
    };
}
function stripMountPrefix(absolutePath) {
    if (absolutePath.startsWith(MOUNT_PREFIX))
        return absolutePath.slice(MOUNT_PREFIX.length);
    if (absolutePath === "/repo")
        return "";
    return absolutePath;
}
