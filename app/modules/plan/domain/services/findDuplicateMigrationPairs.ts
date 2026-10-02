export type DuplicateMigrationPair = {
  file: string;
  original: string;
};

const NEW_SUFFIX = "_new";

// Migraciones a medias: `X_new.ext` cuyo `X.ext` sigue existiendo (en cualquier carpeta). El
// basename se parte en el PRIMER punto, asi `.lib.inc` cuenta como una sola extension.
export function findDuplicateMigrationPairs(fileKeys: string[]): DuplicateMigrationPair[] {
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

function basenameOf(fileKey: string): string {
  return fileKey.split("/").pop() as string;
}

function splitFirstDot(name: string): { stem: string; extension: string } {
  const dot = name.indexOf(".");
  return dot === -1 ? { stem: name, extension: "" } : { stem: name.slice(0, dot), extension: name.slice(dot) };
}
