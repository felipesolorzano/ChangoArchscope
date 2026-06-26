import { createHash } from "node:crypto";
/**
 * Hash estable de un conjunto de archivos a partir de su (ruta, mtime, size), sin leer
 * contenido. Ordena por ruta para ser independiente del orden de entrada. mtime+size es el
 * mismo criterio incremental que usan make/rsync: un cambio de contenido casi siempre mueve
 * el mtime, asi que el hash cambia y el cache se invalida.
 */
export function fingerprintFromStats(stats) {
    const lines = stats
        .map((stat) => `${stat.path}:${stat.mtimeMs}:${stat.size}`)
        .sort();
    return createHash("sha1").update(lines.join("\n")).digest("hex");
}
