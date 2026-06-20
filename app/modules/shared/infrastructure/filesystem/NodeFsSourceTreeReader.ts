import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";

import type { SourceTreeReader } from "../../domain/repositories/SourceTreeReader.js";

export class NodeFsSourceTreeReader implements SourceTreeReader {
  listDirectories(directory: string): string[] {
    try {
      return readdirSync(directory)
        .map((entry) => path.join(directory, entry))
        .filter((entryPath) => statSync(entryPath).isDirectory())
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  walkFiles(directory: string, extensions: string[], ignoredPaths: string[] = []): string[] {
    const files: string[] = [];

    const isIgnored = (target: string): boolean => {
      const relative = path.relative(directory, target).split(path.sep).join("/");
      return ignoredPaths.some((pattern) => minimatch(relative, pattern, { dot: true }));
    };

    const visit = (current: string) => {
      let entries: Dirent[] = [];

      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
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
