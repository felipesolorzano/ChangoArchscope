// Altura estimada de la tarjeta de archivo (bc-file: 220px de ancho, nota en 10px) para apilarlas sin
// que una nota larga quede tapada por la tarjeta siguiente.
const BASE_HEIGHT = 60;
const NOTE_GAP = 5;
const NOTE_LINE_HEIGHT = 13;
const NOTE_CHARS_PER_LINE = 34;

export function fileCardHeight(note?: string): number {
  if (!note) {
    return BASE_HEIGHT;
  }

  return BASE_HEIGHT + NOTE_GAP + Math.ceil(note.length / NOTE_CHARS_PER_LINE) * NOTE_LINE_HEIGHT;
}
