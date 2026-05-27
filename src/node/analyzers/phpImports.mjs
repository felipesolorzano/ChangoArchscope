import { readText } from "./fsUtils.mjs";

export function phpImports(file) {
  const imports = [];
  const lines = readText(file).split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (/^(final\s+)?(class|interface|trait|enum)\s+/.test(line)) {
      break;
    }

    const match = line.match(/^use\s+([^;{]+);/);

    if (!match) {
      continue;
    }

    let imported = match[1].trim();

    if (/^(function|const)\s+/.test(imported)) {
      continue;
    }

    imported = imported.replace(/\s+as\s+.+$/i, "").replace(/\s+/g, "").replace(/^\\/, "");

    if (imported) {
      imports.push({ import: imported, line: index + 1 });
    }
  }

  return imports;
}
