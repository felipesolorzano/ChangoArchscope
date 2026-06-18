import path from "node:path";

import type { SourceTreeReader } from "../../domain/repositories/SourceTreeReader.js";
import { resolveSourceFileCandidate } from "../../domain/services/resolveSourceFileCandidate.js";
import type { ImportReference } from "./phpImports.js";

export const reactSourceExtensions = [".ts", ".tsx", ".js", ".jsx"];

export function tsImports(file: string, reader: SourceTreeReader): ImportReference[] {
  const imports: ImportReference[] = [];
  const text = reader.readText(file);
  const pattern = /import(?:\s+type)?(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;

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

export function resolveSourceImport(
  importPath: string,
  sourceDirectory: string,
  reader: SourceTreeReader,
): string | null {
  const base = path.resolve(sourceDirectory, importPath);

  return resolveSourceFileCandidate(base, reactSourceExtensions, reader);
}

function lineForIndex(text: string, index: number): number {
  return text.slice(0, index).split(/\r?\n/).length;
}
