import path from "node:path";
// Entry points de un bundle (`index.*`, y el `main.*` de Vite/CRA): nadie los importa y montan la app.
const ENTRY_POINT_NAMES = new Set(["index", "main"]);
export function isJsEntryPoint(file) {
    return ENTRY_POINT_NAMES.has(path.posix.parse(file).name);
}
