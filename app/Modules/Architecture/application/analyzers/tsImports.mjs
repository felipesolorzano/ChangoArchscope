import { existsSync } from "node:fs";
import path from "node:path";
import { readText } from "./fsUtils.mjs";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];

export function tsImports(file) {
  const imports = [];
  const text = readText(file);
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

export function resolveSourceImport(importPath, sourceDirectory) {
  const base = path.resolve(sourceDirectory, importPath);

  if (existsSync(base)) {
    return base;
  }

  for (const extension of sourceExtensions) {
    const candidate = `${base}${extension}`;

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  for (const extension of sourceExtensions) {
    const candidate = path.join(base, `index${extension}`);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function lineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}
