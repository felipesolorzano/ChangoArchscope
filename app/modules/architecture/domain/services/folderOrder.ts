// Orden de carpetas de un arbol React plano: de arriba (entrada) hacia abajo (base). Un elemento
// string[] agrupa carpetas del mismo nivel.
export type FolderOrder = Array<string | string[]>;

export function folderRank(folderOrder: FolderOrder, folder: string): number | null {
  const rank = folderOrder.findIndex((level) => (Array.isArray(level) ? level.includes(folder) : level === folder));
  return rank === -1 ? null : rank;
}

// Violacion = importar una carpeta que esta por ENCIMA (rango menor). Fuera del orden: sin regla.
export function folderOrderViolation(folderOrder: FolderOrder, source: string, target: string): boolean {
  const sourceRank = folderRank(folderOrder, source);
  const targetRank = folderRank(folderOrder, target);

  // Origen fuera del orden: rango -1, ningun destino queda "por encima".
  return targetRank !== null && targetRank < (sourceRank ?? -1);
}
