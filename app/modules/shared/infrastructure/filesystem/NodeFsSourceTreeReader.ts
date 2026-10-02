import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import type { SourceTreeReader } from "../../domain/repositories/SourceTreeReader.js";

export class NodeFsSourceTreeReader implements SourceTreeReader {
  // Stryker disable next-line ArrayDeclaration: un default no vacio solo excluiria una carpeta con ese nombre literal, mutante equivalente.
  listDirectories(directory: string, ignoredPaths: string[] = []): string[] {
    try {
      return readdirSync(directory)
        .filter((entry) => !matchesAny(entry, ignoredPaths))
        .map((entry) => path.join(directory, entry))
        .filter((entryPath) => statSync(entryPath).isDirectory())
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  // Stryker disable next-line ArrayDeclaration: un default no vacio solo excluiria un path con ese nombre literal, mutante equivalente.
  walkFiles(directory: string, extensions: string[], ignoredPaths: string[] = []): string[] {
    const files: string[] = [];

    const isIgnored = (target: string): boolean => {
      const relative = path.relative(directory, target).split(path.sep).join("/");
      return matchesAny(relative, ignoredPaths);
    };

    const visit = (current: string) => {
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

  readText(file: string): string {
    return readFileSync(file, "utf8");
  }

  isFile(targetPath: string): boolean {
    try {
      return statSync(targetPath).isFile();
    } catch {
      return false;
    }
  }
}

// Entradas de un directorio; uno ilegible o inexistente se trata como vacio.
function readEntries(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

// Ruta relativa posix contra los patrones glob; `dot` para que `*`/`**` alcancen nombres ocultos.
function matchesAny(relative: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(relative, pattern, { dot: true }));
}
