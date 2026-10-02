import path from "node:path";

import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import { detectRuntimes, type RuntimeDeclarations } from "../../domain/services/detectRuntimes.js";
import {
  type ComposerRuntimeDeclaration,
  type NpmRuntimeDeclaration,
  parseComposerManifest,
  parsePackageManifest,
} from "../../domain/services/parseManifests.js";
import type { DeclaredDependency, DependencyInventory, RuntimeKind } from "../../domain/value-objects/Dependency.js";
import type { RuntimeProbe } from "../contracts/RuntimeProbe.js";

export type DetectDependenciesInput = {
  target: string;
  root: string;
  ignoredPaths: string[];
  reader: SourceTreeReader;
  probe: RuntimeProbe;
};

const MANIFESTS = {
  npm: { file: "package.json", lock: "package-lock.json" },
  composer: { file: "composer.json", lock: "composer.lock" },
} as const;

const ALWAYS_IGNORED = ["**/node_modules", "**/vendor"];

// Inventario de paquetes del stack: manifiestos debajo de la raiz y el principal hacia arriba.
// Corre en cada llamada (sin cache), asi un paquete recien agregado aparece al refrescar.
export function detectDependencies({ target, root, ignoredPaths, reader, probe }: DetectDependenciesInput): DependencyInventory {
  const below = reader
    .walkFiles(root, [MANIFESTS.npm.file, MANIFESTS.composer.file], [...ignoredPaths, ...ALWAYS_IGNORED])
    .filter((file) => isManifestName(path.basename(file)));
  const main = {
    npm: mainManifest(root, MANIFESTS.npm.file, reader),
    composer: mainManifest(root, MANIFESTS.composer.file, reader),
  };
  const manifests = [...new Set([...below, ...[main.npm, main.composer].filter((file): file is string => file !== null)])].sort();

  // Llave null = "no hay principal" de ese tipo: get(null) no encuentra nada.
  const parsed = new Map<string | null, ParsedManifest>();
  const skipped: DependencyInventory["skipped"] = [];

  for (const manifest of manifests) {
    try {
      parsed.set(manifest, parseManifest(manifest, reader));
    } catch (error) {
      skipped.push({ manifest, reason: (error as Error).message });
    }
  }

  const declarations: RuntimeDeclarations = {
    composer: parsed.get(main.composer)?.composer,
    npm: parsed.get(main.npm)?.npm,
    nodeVersionFile: main.npm === null ? null : nodeVersionFile(path.dirname(main.npm), reader),
  };

  return {
    root,
    manifests,
    runtimes: detectRuntimes(declarations, runtimeKinds(target, manifests), (kind) => probe.versionOf(kind)),
    dependencies: [...parsed.values()].flatMap((manifest) => manifest.dependencies),
    skipped,
  };
}

function isManifestName(name: string): boolean {
  return name === MANIFESTS.npm.file || name === MANIFESTS.composer.file;
}

// El de la raiz o, si no hay, el mas cercano hacia arriba sin pasar de la carpeta con .git.
function mainManifest(root: string, file: string, reader: SourceTreeReader): string | null {
  let directory = root;

  while (true) {
    const candidate = path.join(directory, file);
    if (reader.isFile(candidate)) {
      return candidate;
    }

    const parent = path.dirname(directory);
    if (hasGit(directory, reader) || parent === directory) {
      return null;
    }
    directory = parent;
  }
}

function hasGit(directory: string, reader: SourceTreeReader): boolean {
  const git = path.join(directory, ".git");
  return reader.isFile(git) || reader.listDirectories(directory).includes(git);
}

type ParsedManifest = { dependencies: DeclaredDependency[]; npm?: NpmRuntimeDeclaration; composer?: ComposerRuntimeDeclaration };

function parseManifest(manifest: string, reader: SourceTreeReader): ParsedManifest {
  const isNpm = path.basename(manifest) === MANIFESTS.npm.file;
  const lock = path.join(path.dirname(manifest), isNpm ? MANIFESTS.npm.lock : MANIFESTS.composer.lock);
  const lockText = reader.isFile(lock) ? reader.readText(lock) : null;
  const text = reader.readText(manifest);

  if (isNpm) {
    const { dependencies, runtime } = parsePackageManifest(manifest, text, lockText);
    return { dependencies, npm: runtime };
  }

  const { dependencies, runtime } = parseComposerManifest(manifest, text, lockText);
  return { dependencies, composer: runtime };
}

function nodeVersionFile(directory: string, reader: SourceTreeReader): RuntimeDeclarations["nodeVersionFile"] {
  const name = [".nvmrc", ".node-version"].find((candidate) => reader.isFile(path.join(directory, candidate)));
  return name ? { name, text: reader.readText(path.join(directory, name)) } : null;
}

// En orden php, node, npm: php si hay Composer o es laravel; node/npm si hay npm o es react.
function runtimeKinds(target: string, manifests: string[]): RuntimeKind[] {
  const has = (file: string) => manifests.some((manifest) => path.basename(manifest) === file);
  const php: RuntimeKind[] = has(MANIFESTS.composer.file) || target === "laravel" ? ["php"] : [];
  const node: RuntimeKind[] = has(MANIFESTS.npm.file) || target === "react" ? ["node", "npm"] : [];

  return [...php, ...node];
}
