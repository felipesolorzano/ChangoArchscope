const COMPOSER_COPY_KEYS = ["homepage", "repositories", "support", "source"];

/**
 * Un manifiesto anidado es de una libreria copiada (no del proyecto) si apunta a su propio origen:
 * package.json con repository/homepage y no privado; composer.json con homepage, repositories,
 * support o source que no es de tipo project.
 */
export function isLibraryCopy(fileName: string, json: Record<string, unknown>): boolean {
  if (fileName === "package.json") {
    return (json.repository !== undefined || json.homepage !== undefined) && json.private !== true;
  }
  return COMPOSER_COPY_KEYS.some((key) => json[key] !== undefined) && json.type !== "project";
}
