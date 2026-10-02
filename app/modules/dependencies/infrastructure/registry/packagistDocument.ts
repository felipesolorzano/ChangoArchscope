import type { PackageInfo, PackageRelease } from "../../domain/value-objects/Dependency.js";

type Entry = Record<string, unknown>;
type PackagistDocument = { packages?: Record<string, Entry[]> };

// Formato "composer/2.0": cada entrada hereda de la anterior expandida; "__unset" borra la clave.
export function expandMinified(entries: Entry[]): Entry[] {
  const expanded: Entry[] = [];
  let previous: Entry = {};

  for (const entry of entries) {
    const current: Entry = { ...previous, ...entry };
    for (const [key, value] of Object.entries(entry)) {
      if (value === "__unset") {
        delete current[key];
      }
    }
    expanded.push(current);
    previous = current;
  }

  return expanded;
}

// repo.packagist.org/p2/<name>.json: releases con require.php y fecha; abandoned de la mas nueva.
export function mapPackagistDocument(name: string, json: PackagistDocument): PackageInfo {
  const entries = expandMinified(json.packages?.[name] ?? []);
  const abandoned = entries[0]?.abandoned;
  const releases = entries.map((entry): PackageRelease => {
    const php = (entry.require as Record<string, string> | undefined)?.php;
    return {
      version: entry.version as string,
      deprecated: null,
      requires: php === undefined ? {} : { php },
      publishedAt: (entry.time as string | undefined) ?? null,
    };
  });

  return {
    ecosystem: "composer",
    name,
    releases,
    abandoned: typeof abandoned === "string" || abandoned === true ? abandoned : null,
  };
}
