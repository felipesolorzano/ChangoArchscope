export function folderRank(folderOrder, folder) {
    const rank = folderOrder.findIndex((level) => (Array.isArray(level) ? level.includes(folder) : level === folder));
    return rank === -1 ? null : rank;
}
// Violacion = importar una carpeta que esta por ENCIMA (rango menor). Fuera del orden: sin regla.
export function folderOrderViolation(folderOrder, source, target) {
    const sourceRank = folderRank(folderOrder, source);
    const targetRank = folderRank(folderOrder, target);
    // Origen fuera del orden: rango -1, ningun destino queda "por encima".
    return targetRank !== null && targetRank < (sourceRank ?? -1);
}
