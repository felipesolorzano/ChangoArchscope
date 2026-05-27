import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function listDirectories(directory) {
  try {
    return readdirSync(directory)
      .map((entry) => path.join(directory, entry))
      .filter((entryPath) => statSync(entryPath).isDirectory())
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function walkFiles(directory, extensions) {
  const files = [];

  function visit(current) {
    let entries = [];

    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  visit(directory);

  return files.sort((a, b) => a.localeCompare(b));
}

export function readText(file) {
  return readFileSync(file, "utf8");
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function relativePosix(from, to) {
  return toPosixPath(path.relative(from, to));
}

export function nowIso() {
  return new Date().toISOString();
}
