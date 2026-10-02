export type Usage = { files: number; inManifest: boolean; unused: boolean };

const TOOLING_PREFIXES = [
  "@types/", "@babel/", "@typescript-eslint/", "@testing-library/", "@svgr/", "@vitejs/", "@vitest/", "@jest/",
  "eslint", "babel-", "jest", "webpack", "postcss", "stylelint", "prettier", "ts-",
];
const TOOLING_SUFFIXES = ["-loader", "-plugin"];
const TOOLING_NAMES = new Set(["typescript", "vite", "vitest", "sass", "node-sass", "tsx"]);
const LITERAL = /["'`]([^"'`\s]+)["'`]/g;

// Paquetes citados en el texto: cada literal sin espacios reducido a su paquete ("@a/b/c" → "@a/b").
export function referencedPackages(source: string): Set<string> {
  return new Set([...source.matchAll(LITERAL)].map(([, literal]) => packageOf(literal)));
}

function packageOf(literal: string): string {
  const segments = literal.split("/");
  return literal.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

// El paquete aparece como literal de modulo: "name", 'name/sub', `name`.
export function isReferenced(source: string, name: string): boolean {
  return referencedPackages(source).has(name);
}

/** Paquetes que se usan sin importarse (config, CLI, tipos): nunca se marcan "sin uso". */
export function isTooling(name: string): boolean {
  return (
    TOOLING_NAMES.has(name) ||
    TOOLING_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    TOOLING_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

// Los de desarrollo nunca son "sin uso": se usan por CLI, configuracion o carga indirecta.
export function usageOf(name: string, dev: boolean, references: Set<string>[], manifestConfig: string): Usage {
  const files = references.filter((packages) => packages.has(name)).length;
  const inManifest = mentionsWord(manifestConfig, name);

  return { files, inManifest, unused: files === 0 && !inManifest && !dev && !isTooling(name) };
}

// El nombre como palabra: no pegado a otro nombre de paquete ("react" no cuenta en "react-scripts").
function mentionsWord(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w@/.-])${escaped}($|[^\\w.-])`).test(text);
}
