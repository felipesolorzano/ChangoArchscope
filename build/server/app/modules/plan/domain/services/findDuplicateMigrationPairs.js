const NEW_SUFFIX = "_new";
// Migraciones a medias: `X_new.ext` cuyo `X.ext` sigue existiendo (en cualquier carpeta). El
// basename se parte en el PRIMER punto, asi `.lib.inc` cuenta como una sola extension.
export function findDuplicateMigrationPairs(fileKeys) {
    const basenames = new Set(fileKeys.map(basenameOf));
    return fileKeys.flatMap((file) => {
        const { stem, extension } = splitFirstDot(basenameOf(file));
        if (!stem.endsWith(NEW_SUFFIX)) {
            return [];
        }
        const original = stem.slice(0, -NEW_SUFFIX.length) + extension;
        return basenames.has(original) ? [{ file, original }] : [];
    });
}
function basenameOf(fileKey) {
    return fileKey.split("/").pop();
}
function splitFirstDot(name) {
    const dot = name.indexOf(".");
    return dot === -1 ? { stem: name, extension: "" } : { stem: name.slice(0, dot), extension: name.slice(dot) };
}
