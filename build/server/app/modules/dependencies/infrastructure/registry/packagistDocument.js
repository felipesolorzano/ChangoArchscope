// Formato "composer/2.0": cada entrada hereda de la anterior expandida; "__unset" borra la clave.
export function expandMinified(entries) {
    const expanded = [];
    let previous = {};
    for (const entry of entries) {
        const current = { ...previous, ...entry };
        for (const [key, value] of Object.entries(entry)) {
            if (value === "__unset") {
                delete current[key];
            }
        }
        expanded.push(current);
        previous = current;
    }
    return expanded;
}
// repo.packagist.org/p2/<name>.json: releases con require.php y fecha; abandoned de la mas nueva.
export function mapPackagistDocument(name, json) {
    const entries = expandMinified(json.packages?.[name] ?? []);
    const abandoned = entries[0]?.abandoned;
    const releases = entries.map((entry) => {
        const php = entry.require?.php;
        return {
            version: entry.version,
            deprecated: null,
            requires: php === undefined ? {} : { php },
            publishedAt: entry.time ?? null,
        };
    });
    return {
        ecosystem: "composer",
        name,
        releases,
        abandoned: typeof abandoned === "string" || abandoned === true ? abandoned : null,
    };
}
