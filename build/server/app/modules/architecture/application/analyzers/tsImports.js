import path from "node:path";
import { resolveSourceFileCandidate } from "../../domain/services/resolveSourceFileCandidate.js";
export const reactSourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
export function tsImports(file, reader) {
    const imports = [];
    const text = reader.readText(file);
    // Alternativas: `import … from "x"` (el tramo hasta `from` no cruza comillas ni `;`, asi un
    // `import "x"` sin `from` no se traga el import siguiente), `import "x"`, `import("x")`, `require("x")`.
    const pattern = /\bimport\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|(?<![.\w$])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = pattern.exec(text))) {
        // Cada alternativa captura una ruta no vacia, asi que siempre hay una.
        const imported = match[1] || match[2] || match[3] || match[4];
        imports.push({
            import: imported,
            line: lineForIndex(text, match.index),
        });
    }
    return imports;
}
export function resolveSourceImport(importPath, sourceDirectory, reader) {
    const base = path.resolve(sourceDirectory, importPath);
    return resolveSourceFileCandidate(base, reactSourceExtensions, reader);
}
function lineForIndex(text, index) {
    return text.slice(0, index).split(/\r?\n/).length;
}
