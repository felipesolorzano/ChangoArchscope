import { minVersionOf, normalizeVersion } from "./versioning.js";
// Runtime que usa el proyecto: lo declarado en su manifiesto principal y, si no, el binario local.
export function detectRuntimes(declarations, kinds, probe) {
    return kinds.map((kind) => {
        const candidates = [...declaredCandidates(kind, declarations), { source: "local", version: normalizeOrNull(probe(kind)) }];
        const found = candidates.find((candidate) => candidate.version !== null);
        return found ? { kind, version: found.version, source: found.source } : { kind, version: null, source: "desconocido" };
    });
}
function declaredCandidates(kind, { composer, npm, nodeVersionFile }) {
    if (kind === "php") {
        return [
            { source: "composer.json config.platform.php", version: normalizeOrNull(composer?.platformPhp) },
            { source: "composer.json require.php", version: minOrNull(composer?.php, "composer") },
        ];
    }
    if (kind === "node") {
        const versionFile = nodeVersionFile ? [{ source: nodeVersionFile.name, version: normalizeOrNull(nodeVersionFile.text) }] : [];
        // Stryker disable next-line StringLiteral: para engines el ecosistema solo cambia la traduccion de Composer, que no mueve la minima, mutante equivalente.
        return [...versionFile, { source: "package.json engines.node", version: minOrNull(npm?.node, "npm") }];
    }
    const packageManager = npm?.packageManager?.match(/^npm@(.+)/)?.[1];
    return [
        { source: "package.json packageManager", version: normalizeOrNull(packageManager) },
        // Stryker disable next-line StringLiteral: para engines el ecosistema solo cambia la traduccion de Composer, que no mueve la minima, mutante equivalente.
        { source: "package.json engines.npm", version: minOrNull(npm?.npm, "npm") },
    ];
}
function normalizeOrNull(raw) {
    return raw ? normalizeVersion(raw) : null;
}
function minOrNull(constraint, ecosystem) {
    return constraint ? minVersionOf(constraint, ecosystem) : null;
}
