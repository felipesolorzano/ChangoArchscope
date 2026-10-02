import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
export class NodeFsSourceTreeReader {
    // Stryker disable next-line ArrayDeclaration: un default no vacio solo excluiria una carpeta con ese nombre literal, mutante equivalente.
    listDirectories(directory, ignoredPaths = []) {
        try {
            return readdirSync(directory)
                .filter((entry) => !matchesAny(entry, ignoredPaths))
                .map((entry) => path.join(directory, entry))
                .filter((entryPath) => statSync(entryPath).isDirectory())
                .sort((a, b) => a.localeCompare(b));
        }
        catch {
            return [];
        }
    }
    // Stryker disable next-line ArrayDeclaration: un default no vacio solo excluiria un path con ese nombre literal, mutante equivalente.
    walkFiles(directory, extensions, ignoredPaths = []) {
        const files = [];
        const isIgnored = (target) => {
            const relative = path.relative(directory, target).split(path.sep).join("/");
            return matchesAny(relative, ignoredPaths);
        };
        const visit = (current) => {
            for (const entry of readEntries(current)) {
                const entryPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    if (!isIgnored(entryPath)) {
                        visit(entryPath);
                    }
                    continue;
                }
                if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)) && !isIgnored(entryPath)) {
                    files.push(entryPath);
                }
            }
        };
        visit(directory);
        return files.sort((a, b) => a.localeCompare(b));
    }
    readText(file) {
        return readFileSync(file, "utf8");
    }
    isFile(targetPath) {
        try {
            return statSync(targetPath).isFile();
        }
        catch {
            return false;
        }
    }
}
// Entradas de un directorio; uno ilegible o inexistente se trata como vacio.
function readEntries(directory) {
    try {
        return readdirSync(directory, { withFileTypes: true });
    }
    catch {
        return [];
    }
}
// Ruta relativa posix contra los patrones glob; `dot` para que `*`/`**` alcancen nombres ocultos.
function matchesAny(relative, patterns) {
    return patterns.some((pattern) => minimatch(relative, pattern, { dot: true }));
}
