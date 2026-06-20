// Adaptador entre bounded contexts: traduce el AuditSnapshot (del que solo conocemos el tipo)
// a las señales que necesita el generador del plan. Asi el dominio de `plan` no depende de `audit`.
export function auditSnapshotToSignals(snapshot) {
    const ruleCounts = {};
    for (const finding of snapshot.findings) {
        ruleCounts[finding.rule] = (ruleCounts[finding.rule] ?? 0) + 1;
    }
    return {
        ruleCounts,
        categoryCounts: snapshot.summary.by_category,
        duplicatePairs: countDuplicatePairs(snapshot.riskBreakdown.byFile.map((entry) => entry.key)),
        skippedFiles: snapshot.skippedFiles.length,
    };
}
// Cuenta pares X / X_new (migraciones a medias) por nombre de archivo.
function countDuplicatePairs(fileKeys) {
    const names = new Set(fileKeys.map((key) => key.split("/").pop() ?? key));
    let pairs = 0;
    for (const name of names) {
        const dot = name.indexOf(".");
        const stem = dot === -1 ? name : name.slice(0, dot);
        const extension = dot === -1 ? "" : name.slice(dot);
        if (stem.endsWith("_new") && names.has(stem.slice(0, -"_new".length) + extension)) {
            pairs += 1;
        }
    }
    return pairs;
}
