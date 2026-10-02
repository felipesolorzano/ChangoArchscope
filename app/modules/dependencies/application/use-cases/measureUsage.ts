import path from "node:path";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { referencedPackages, usageOf, type Usage } from "../../domain/services/packageUsage.js";
import type { DeclaredDependency } from "../../domain/value-objects/Dependency.js";

const SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const IGNORED = ["**/node_modules", "**/vendor", "**/.*", "**/build", "**/dist", "**/coverage"];
const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

export type MeasureUsageInput = { dependencies: DeclaredDependency[]; reader: SourceTreeReader };

export function usageKey(dependency: Pick<DeclaredDependency, "ecosystem" | "name" | "manifest">): string {
  return `${dependency.ecosystem}:${dependency.name}|${dependency.manifest}`;
}

// Cuanto se usa cada paquete npm en las fuentes de la carpeta de su manifiesto (Composer no se mide).
export function measureUsage({ dependencies, reader }: MeasureUsageInput): Map<string, Usage> {
  const usage = new Map<string, Usage>();
  const npm = dependencies.filter((dependency) => dependency.ecosystem === "npm");

  for (const manifest of new Set(npm.map((dependency) => dependency.manifest))) {
    const context = manifestContext(manifest, reader);
    if (context === null) {
      continue;
    }
    for (const dependency of npm.filter((entry) => entry.manifest === manifest)) {
      usage.set(usageKey(dependency), usageOf(dependency.name, dependency.dev, context.references, context.config));
    }
  }

  return usage;
}

function manifestContext(manifest: string, reader: SourceTreeReader): { references: Set<string>[]; config: string } | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(reader.readText(manifest));
  } catch {
    return null;
  }

  const config = JSON.stringify(Object.fromEntries(Object.entries(json).filter(([key]) => !DEPENDENCY_SECTIONS.includes(key))));
  const references = reader.walkFiles(path.dirname(manifest), SOURCE_EXTENSIONS, IGNORED).map((file) => referencedPackages(reader.readText(file)));

  return { references, config };
}
