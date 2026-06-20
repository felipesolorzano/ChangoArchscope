const NEW_SUFFIX = "_new";
// Separa el "stem" (nombre hasta el primer punto) de la extension (el resto).
// "OrderService_new.lib.inc" -> ["OrderService_new", ".lib.inc"].
function splitStem(label) {
    const dot = label.indexOf(".");
    return dot === -1 ? [label, ""] : [label.slice(0, dot), label.slice(dot)];
}
// Dado un archivo `X_new.<ext>`, devuelve el nombre exacto de su original `X.<ext>`.
// Devuelve null si el archivo no es una variante `_new`.
export function originalLabelOf(label) {
    const [stem, extension] = splitStem(label);
    if (!stem.endsWith(NEW_SUFFIX)) {
        return null;
    }
    return stem.slice(0, -NEW_SUFFIX.length) + extension;
}
// Detecta migraciones a medias: un archivo X y su clon X_new conviviendo en la misma app.
// Genera un edge `duplicate` del original hacia el `_new`. El emparejamiento es por nombre
// exacto reconstruido (conserva la extension completa, incl. compuestas como `.lib.inc`),
// para no confundir `OrderService.translations.lib.inc` con `OrderService_new.lib.inc`.
export function findDuplicateEdges(candidates) {
    const idByLabel = new Map();
    for (const candidate of candidates) {
        if (!idByLabel.has(candidate.label)) {
            idByLabel.set(candidate.label, candidate.id);
        }
    }
    const edges = [];
    for (const candidate of candidates) {
        const originalLabel = originalLabelOf(candidate.label);
        if (originalLabel === null) {
            continue;
        }
        const originalId = idByLabel.get(originalLabel);
        if (originalId !== undefined && originalId !== candidate.id) {
            edges.push({
                id: `duplicate:${originalId}:${candidate.id}`,
                source: originalId,
                target: candidate.id,
                kind: "duplicate",
            });
        }
    }
    return edges;
}
