import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";

export type ImportReference = {
  import: string;
  line: number;
};

export function phpImports(file: string, reader: SourceTreeReader): ImportReference[] {
  const imports: ImportReference[] = [];
  const lines = reader.readText(file).split(/\r?\n/);

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
