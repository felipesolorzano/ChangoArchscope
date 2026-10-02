import type { DetectedRuntime, RuntimeKind } from "../value-objects/Dependency.js";
import type { ComposerRuntimeDeclaration, NpmRuntimeDeclaration } from "./parseManifests.js";
import { minVersionOf, normalizeVersion } from "./versioning.js";

export type RuntimeDeclarations = {
  composer?: ComposerRuntimeDeclaration | null;
  npm?: NpmRuntimeDeclaration | null;
  nodeVersionFile?: { name: string; text: string } | null;
};

type Candidate = { source: string; version: string | null };

// Runtime que usa el proyecto: lo declarado en su manifiesto principal y, si no, el binario local.
export function detectRuntimes(
  declarations: RuntimeDeclarations,
  kinds: RuntimeKind[],
  probe: (kind: RuntimeKind) => string | null,
): DetectedRuntime[] {
  return kinds.map((kind) => {
    const candidates = [...declaredCandidates(kind, declarations), { source: "local", version: normalizeOrNull(probe(kind)) }];
    const found = candidates.find((candidate) => candidate.version !== null);

    return found ? { kind, version: found.version, source: found.source } : { kind, version: null, source: "desconocido" };
  });
}

function declaredCandidates(kind: RuntimeKind, { composer, npm, nodeVersionFile }: RuntimeDeclarations): Candidate[] {
  if (kind === "php") {
    return [
      { source: "composer.json config.platform.php", version: normalizeOrNull(composer?.platformPhp) },
      { source: "composer.json require.php", version: minOrNull(composer?.php, "composer") },
    ];
  }

  if (kind === "node") {
    const versionFile = nodeVersionFile ? [{ source: nodeVersionFile.name, version: normalizeOrNull(nodeVersionFile.text) }] : [];
    // Stryker disable next-line StringLiteral: para engines el ecosistema solo cambia la traduccion de Composer, que no mueve la minima, mutante equivalente.
    return [...versionFile, { source: "package.json engines.node", version: minOrNull(npm?.node, "npm") }];
  }

  const packageManager = npm?.packageManager?.match(/^npm@(.+)/)?.[1];
  return [
    { source: "package.json packageManager", version: normalizeOrNull(packageManager) },
    // Stryker disable next-line StringLiteral: para engines el ecosistema solo cambia la traduccion de Composer, que no mueve la minima, mutante equivalente.
    { source: "package.json engines.npm", version: minOrNull(npm?.npm, "npm") },
  ];
}

function normalizeOrNull(raw: string | null | undefined): string | null {
  return raw ? normalizeVersion(raw) : null;
}

function minOrNull(constraint: string | undefined, ecosystem: "npm" | "composer"): string | null {
  return constraint ? minVersionOf(constraint, ecosystem) : null;
}
