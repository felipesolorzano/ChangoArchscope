import path from "node:path";

import semver from "semver";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { identifyVendored } from "../../domain/services/vendoredCatalog.js";
import type { DeclaredDependency } from "../../domain/value-objects/Dependency.js";

const EXTENSIONS = [".js", ".css", ".php", ".inc"];
// vendor y node_modules los gestiona el gestor de paquetes: ya salen por su manifiesto.
const ALWAYS_IGNORED = ["**/node_modules", "**/vendor", "**/.*"];

export type DetectVendoredInput = { root: string; ignoredPaths: string[]; reader: SourceTreeReader };

// Librerias conocidas copiadas a mano: una dependencia por libreria y version, con sus copias.
export function detectVendoredLibraries({ root, ignoredPaths, reader }: DetectVendoredInput): DeclaredDependency[] {
  const groups = new Map<string, DeclaredDependency & { vendored: { files: number } }>();

  for (const file of reader.walkFiles(root, EXTENSIONS, [...ignoredPaths, ...ALWAYS_IGNORED])) {
    const library = identifyVendored(path.basename(file), reader.readText(file));
    if (library === null) {
      continue;
    }

    const key = `${library.ecosystem}:${library.name}@${library.version}`;
    const group = groups.get(key);
    if (group) {
      group.vendored.files += 1;
    } else {
      groups.set(key, { ecosystem: library.ecosystem, name: library.name, constraint: library.version, installed: library.version, dev: false, manifest: file, vendored: { files: 1 } });
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || semver.compare(a.constraint, b.constraint));
}
