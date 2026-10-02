// Documento completo de registry.npmjs.org/<name>: releases con deprecated, engines y fecha.
export function mapNpmDocument(name, json) {
    const releases = Object.values(json.versions ?? {}).map((version) => ({
        version: version.version,
        deprecated: typeof version.deprecated === "string" && version.deprecated !== "" ? version.deprecated : null,
        requires: enginesOf(version.engines),
        publishedAt: json.time?.[version.version] ?? null,
    }));
    return { ecosystem: "npm", name, releases, abandoned: null };
}
// Paquetes viejos declaran engines como array de strings: no se puede evaluar, no restringe.
function enginesOf(engines) {
    const record = (Array.isArray(engines) ? {} : (engines ?? {}));
    const requires = {};
    for (const kind of ["node", "npm"]) {
        if (typeof record[kind] === "string") {
            requires[kind] = record[kind];
        }
    }
    return requires;
}
