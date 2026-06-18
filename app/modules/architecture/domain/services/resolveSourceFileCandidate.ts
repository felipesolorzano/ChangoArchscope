import path from "node:path";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";

export function resolveSourceFileCandidate(
  base: string,
  extensions: string[],
  reader: SourceTreeReader,
): string | null {
  if (reader.isFile(base)) {
    return base;
  }

  for (const extension of extensions) {
    const candidate = `${base}${extension}`;

    if (reader.isFile(candidate)) {
      return candidate;
    }
  }

  for (const extension of extensions) {
    const candidate = path.join(base, `index${extension}`);

    if (reader.isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}
