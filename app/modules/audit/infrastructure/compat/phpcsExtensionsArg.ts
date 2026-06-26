/**
 * Convierte las extensiones configuradas (`phpExtensions` de chango-archscope.config,
 * p. ej. [".php", ".inc", ".lib.inc"]) al valor de `--extensions` de phpcs.
 *
 * Dos detalles del comportamiento de phpcs:
 * - Solo mira la ULTIMA extension del archivo (`foo.lib.inc` -> `inc`), asi que una
 *   extension compuesta como `.lib.inc` se reduce a su ultimo segmento.
 * - Una extension sin tokenizer (`php`, `inc`) se tokeniza como PHP por defecto, que es
 *   justo lo que queremos para analisis de compatibilidad.
 */
export function phpcsExtensionsArg(extensions: string[]): string {
  const segments = extensions
    // Ultimo segmento tras el punto final: ".php" -> "php", ".lib.inc" -> "inc", "php" -> "php"
    // (sin punto, lastIndexOf da -1 y slice(0) deja la cadena intacta).
    .map((extension) => extension.slice(extension.lastIndexOf(".") + 1))
    .filter((extension) => extension.length > 0);

  const unique = [...new Set(segments)];

  return unique.length > 0 ? unique.join(",") : "php";
}
