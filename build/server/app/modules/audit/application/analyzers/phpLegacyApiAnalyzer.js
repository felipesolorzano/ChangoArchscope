const named = (...names) => (name) => names.includes(name);
const prefixed = (prefix) => (name) => name.startsWith(prefix);
// Funciones eliminadas/deprecadas con reemplazo conocido (XRay X5).
const LEGACY_FUNCTIONS = [
    { pattern: "mysql", matches: prefixed("mysql_"), since: "7.0", removed: true },
    { pattern: "ereg", matches: named("ereg", "eregi", "ereg_replace", "eregi_replace", "split", "spliti", "sql_regcase"), since: "7.0", removed: true },
    { pattern: "mcrypt", matches: prefixed("mcrypt_"), since: "7.2", removed: true },
    { pattern: "each", matches: named("each"), since: "8.0", removed: true },
    { pattern: "create-function", matches: named("create_function"), since: "8.0", removed: true },
    { pattern: "money-format", matches: named("money_format"), since: "8.0", removed: true },
    { pattern: "magic-quotes", matches: named("get_magic_quotes_gpc", "get_magic_quotes_runtime", "set_magic_quotes_runtime"), since: "8.0", removed: true },
    { pattern: "utf8-encode", matches: named("utf8_encode", "utf8_decode"), since: "8.2", removed: false },
];
// Un finding por archivo y funcion: primera llamada y cantidad.
export function phpLegacyApiAnalyzer(files) {
    return files.flatMap((file) => {
        const calls = new Map();
        for (const call of file.functionCalls) {
            const seen = calls.get(call.name);
            calls.set(call.name, { line: seen?.line ?? call.line, count: (seen?.count ?? 0) + 1 });
        }
        return [...calls].flatMap(([name, { line, count }]) => {
            const legacy = LEGACY_FUNCTIONS.find((candidate) => candidate.matches(name));
            return legacy === undefined ? [] : [legacyFinding(file.file, name, line, count, legacy)];
        });
    });
}
function legacyFinding(file, name, line, count, { pattern, since, removed }) {
    return {
        category: "legacy_api",
        rule: removed ? "removed-php-function" : "deprecated-php-function",
        severity: removed ? "high" : "medium",
        source: "native",
        module: "",
        class: null,
        file,
        line,
        message: removed ? `"${name}()" se elimino en PHP ${since}.` : `"${name}()" esta deprecada desde PHP ${since}.`,
        details: { pattern, function: name, count, since },
    };
}
