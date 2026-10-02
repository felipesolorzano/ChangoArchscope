import type { DeclaredDependency, Ecosystem } from "../value-objects/Dependency.js";
import { normalizeVersion } from "./versioning.js";

export type NpmRuntimeDeclaration = { node?: string; npm?: string; packageManager?: string };
export type ComposerRuntimeDeclaration = { php?: string; platformPhp?: string };

type Json = Record<string, any>;

const PACKAGE_SECTIONS: Array<[string, boolean]> = [
  ["dependencies", false],
  ["devDependencies", true],
  ["optionalDependencies", false],
];

const COMPOSER_SECTIONS: Array<[string, boolean]> = [
  ["require", false],
  ["require-dev", true],
];

const PLATFORM_PACKAGES = new Set(["php", "php-64bit", "hhvm", "composer", "composer-plugin-api", "composer-runtime-api"]);

export function parsePackageManifest(
  manifest: string,
  text: string,
  lockText: string | null,
): { dependencies: DeclaredDependency[]; runtime: NpmRuntimeDeclaration } {
  const json: Json = JSON.parse(text);
  const lock = parseLock(lockText);
  const installedOf = (name: string): unknown => lock.packages?.[`node_modules/${name}`]?.version ?? lock.dependencies?.[name]?.version;

  return {
    dependencies: declared("npm", manifest, json, PACKAGE_SECTIONS, () => true, installedOf),
    runtime: { node: json.engines?.node, npm: json.engines?.npm, packageManager: json.packageManager },
  };
}

export function parseComposerManifest(
  manifest: string,
  text: string,
  lockText: string | null,
): { dependencies: DeclaredDependency[]; runtime: ComposerRuntimeDeclaration } {
  const json: Json = JSON.parse(text);
  const lock = parseLock(lockText);
  const locked = [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])] as Array<{ name: string; version: string }>;
  const installedOf = (name: string): unknown => locked.find((entry) => entry.name === name)?.version;

  return {
    dependencies: declared("composer", manifest, json, COMPOSER_SECTIONS, isComposerPackage, installedOf),
    runtime: { php: json.require?.php, platformPhp: json.config?.platform?.php },
  };
}

function isComposerPackage(name: string): boolean {
  return !PLATFORM_PACKAGES.has(name) && !name.startsWith("ext-") && !name.startsWith("lib-");
}

function declared(
  ecosystem: Ecosystem,
  manifest: string,
  json: Json,
  sections: Array<[string, boolean]>,
  include: (name: string) => boolean,
  installedOf: (name: string) => unknown,
): DeclaredDependency[] {
  return sections.flatMap(([section, dev]) =>
    Object.entries((json[section] ?? {}) as Record<string, string>)
      .filter(([name]) => include(name))
      .map(([name, constraint]) => {
        const installed = installedOf(name);
        return { ecosystem, name, constraint, installed: typeof installed === "string" ? normalizeVersion(installed) : null, dev, manifest };
      }),
  );
}

// Un lock ausente o ilegible no invalida el manifiesto: solo se pierde la version instalada.
function parseLock(lockText: string | null): Json {
  try {
    return lockText === null ? {} : JSON.parse(lockText);
  } catch {
    return {};
  }
}
