import type { PackageInfo, PackageRelease } from "../../domain/value-objects/Dependency.js";

type NpmVersion = { version: string; deprecated?: unknown; engines?: Record<string, unknown> | unknown[] };
type NpmDocument = { versions?: Record<string, NpmVersion>; time?: Record<string, string> };

// Documento completo de registry.npmjs.org/<name>: releases con deprecated, engines y fecha.
export function mapNpmDocument(name: string, json: NpmDocument): PackageInfo {
  const releases = Object.values(json.versions ?? {}).map(
    (version): PackageRelease => ({
      version: version.version,
      deprecated: typeof version.deprecated === "string" && version.deprecated !== "" ? version.deprecated : null,
      requires: enginesOf(version.engines),
      publishedAt: json.time?.[version.version] ?? null,
    }),
  );

  return { ecosystem: "npm", name, releases, abandoned: null };
}

// Paquetes viejos declaran engines como array de strings: no se puede evaluar, no restringe.
function enginesOf(engines: NpmVersion["engines"]): PackageRelease["requires"] {
  const record = (Array.isArray(engines) ? {} : (engines ?? {})) as Record<string, unknown>;
  const requires: PackageRelease["requires"] = {};

  for (const kind of ["node", "npm"] as const) {
    if (typeof record[kind] === "string") {
      requires[kind] = record[kind] as string;
    }
  }

  return requires;
}
