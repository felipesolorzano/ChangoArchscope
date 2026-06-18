import path from "node:path";
import { resolveSourceFileCandidate } from "../../domain/services/resolveSourceFileCandidate.js";
export const reactSourceExtensions = [".ts", ".tsx", ".js", ".jsx"];
export function tsImports(file, reader) {
    const imports = [];
    const text = reader.readText(file);
    const pattern = /import(?:\s+type)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = pattern.exec(text))) {
        const imported = match[1] || match[2];
        if (!imported) {
            continue;
        }
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
