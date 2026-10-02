import path from "node:path";

const RESOLVABLE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const DYNAMIC_SEGMENT = "${}";

// Resuelve un import relativo a los archivos escaneados a los que apunta. Uno estatico prueba la
// ruta exacta, las extensiones JS/TS e `index` de carpeta (mismo orden que el bundler) y devuelve
// el primero; uno dinamico (`./config.${}`) devuelve todos los que encajan. Paquetes/alias -> [].
export function resolveJsImport(fromFile: string, source: string, knownFiles: Set<string>): string[] {
  if (!source.startsWith("./") && !source.startsWith("../")) {
    return [];
  }

  const base = path.posix.join(path.posix.dirname(fromFile), source);

  if (base.includes(DYNAMIC_SEGMENT)) {
    return resolvePattern(base, knownFiles);
  }

  const candidates = [
    base,
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];

  return candidates.filter((candidate) => knownFiles.has(candidate)).slice(0, 1);
}

// Cada `${}` es el nombre de un modulo (1+ caracteres sin `/`); siempre seguido de extension o de
// `/index` + extension, como lo resolveria el bundler en runtime.
function resolvePattern(base: string, knownFiles: Set<string>): string[] {
  const fixedParts = base.split(DYNAMIC_SEGMENT).map(escapeRegExp);
  const pattern = new RegExp(`^${fixedParts.join("[^/]+")}(?:/index)?\\.(?:js|jsx|ts|tsx)$`);

  return [...knownFiles].filter((file) => pattern.test(file));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
