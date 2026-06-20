import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
export class NodeFsSourceTreeReader {
    listDirectories(directory) {
        try {
            return readdirSync(directory)
                .map((entry) => path.join(directory, entry))
                .filter((entryPath) => statSync(entryPath).isDirectory())
                .sort((a, b) => a.localeCompare(b));
        }
        catch {
            return [];
        }
    }
    walkFiles(directory, extensions, ignoredPaths = []) {
        const files = [];
        const isIgnored = (target) => {
            const relative = path.relative(directory, target).split(path.sep).join("/");
            return ignoredPaths.some((pattern) => minimatch(relative, pattern, { dot: true }));
        };
        const visit = (current) => {
            let entries = [];
            try {
                entries = readdirSync(current, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
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
