import semver from "semver";

import type {
  DeclaredDependency,
  DependencyReport,
  DependencyStatus,
  PackageInfo,
  PackageRelease,
  RuntimeKind,
  RuntimeSelection,
} from "../value-objects/Dependency.js";
import { minVersionOf, normalizeVersion, satisfiesConstraint, versionGap } from "./versioning.js";

// Compara un paquete contra sus releases: a que version conviene ir con el runtime elegido.
export function classifyDependency(dependency: DeclaredDependency, info: PackageInfo | null, selection: RuntimeSelection): DependencyReport {
  const current = dependency.installed ?? minVersionOf(dependency.constraint, dependency.ecosystem);
  const abandoned = info?.abandoned ?? null;
  const stable = stableReleases(info?.releases ?? []);
  const usable = stable.filter((release) => release.deprecated === null);
  const compatible = usable.filter((release) => fitsRuntime(release, selection, dependency.ecosystem));
  const latestRelease = stable.at(-1);
  const latest = latestRelease?.version ?? null;
  const bestUsable = usable.at(-1)?.version ?? null;
  const recommended = compatible.at(-1)?.version ?? null;
  const gap = current !== null && recommended !== null ? versionGap(current, recommended) : "none";
  const currentRelease = stable.find((release) => release.version === current);
  const deprecation = currentRelease?.deprecated ?? null;

  return {
    ...dependency,
    current,
    latest,
    recommended,
    gap,
    status: statusOf(abandoned, latest, deprecation, gap),
    deprecation,
    replacement: typeof abandoned === "string" ? abandoned : null,
    limitedByRuntime: bestUsable !== recommended,
    currentPublishedAt: currentRelease?.publishedAt ?? null,
    latestPublishedAt: latestRelease?.publishedAt ?? null,
  };
}

// Releases con version valida y sin prerelease, de menor a mayor.
function stableReleases(releases: PackageRelease[]): PackageRelease[] {
  return releases
    .map((release) => ({ ...release, version: normalizeVersion(release.version) ?? "" }))
    .filter((release) => release.version !== "" && semver.prerelease(release.version) === null)
    .sort((a, b) => semver.compare(a.version, b.version));
}

function fitsRuntime(release: PackageRelease, selection: RuntimeSelection, ecosystem: PackageInfo["ecosystem"]): boolean {
  return (Object.entries(release.requires) as Array<[RuntimeKind, string]>).every(
    ([kind, constraint]) => selection[kind] === undefined || satisfiesConstraint(selection[kind] as string, constraint, ecosystem),
  );
}

function statusOf(abandoned: PackageInfo["abandoned"], latest: string | null, deprecation: string | null, gap: DependencyReport["gap"]): DependencyStatus {
  if (latest === null) {
    return "unknown";
  }

  if (abandoned) {
    return "abandoned";
  }

  if (deprecation !== null) {
    return "deprecated";
  }

  return gap === "none" ? "up_to_date" : gap;
}
