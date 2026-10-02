import semver from "semver";

import type { Ecosystem, VersionGap } from "../value-objects/Dependency.js";

const VERSION_PATTERN = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.\d+)*(-[0-9A-Za-z.-]+)?$/i;

// "v1.2" → "1.2.0", "1.2.3.4" → "1.2.3", prerelease se conserva; sin numero → null.
export function normalizeVersion(raw: string): string | null {
  const match = raw.trim().match(VERSION_PATTERN);

  if (!match) {
    return null;
  }

  const [, major, minor = "0", patch = "0", prerelease = ""] = match;
  return semver.valid(`${major}.${minor}.${patch}${prerelease}`);
}

// Composer → rango de semver: | y || son OR; coma/espacios son AND; ~X.Y llega hasta la siguiente major.
export function toNpmRange(constraint: string, ecosystem: Ecosystem): string {
  if (ecosystem !== "composer") {
    return constraint;
  }

  return constraint
    .split(/\|\|?/)
    .map((alternative) =>
      alternative
        .split(/[\s,]/)
        .filter((condition) => condition !== "")
        .map((condition) => composerCondition(condition))
        .join(" "),
    )
    .join(" || ");
}

// Una condicion sin flag de estabilidad ni "v"; "~X.Y" de Composer llega hasta la siguiente major.
function composerCondition(condition: string): string {
  const [, operator, version] = condition.split("@")[0].match(/([<>=!^~]*)v?(.*)/i) as RegExpMatchArray;
  const twoParts = version.match(/^(\d+)\.\d+$/);

  return operator === "~" && twoParts ? `>=${version}.0 <${Number(twoParts[1]) + 1}.0.0` : `${operator}${version}`;
}

// semver.satisfies no lanza: version o rango invalido → false.
export function satisfiesConstraint(version: string, constraint: string, ecosystem: Ecosystem): boolean {
  return semver.satisfies(version, toNpmRange(constraint, ecosystem));
}

export function minVersionOf(constraint: string, ecosystem: Ecosystem): string | null {
  const range = semver.validRange(toNpmRange(constraint, ecosystem));
  return range === null ? null : (semver.minVersion(range)?.version ?? null);
}

export function versionGap(from: string, to: string): VersionGap {
  if (!semver.gt(to, from)) {
    return "none";
  }

  // "premajor"/"preminor" cuentan por su parte; "prepatch"/"prerelease" son patch.
  const part = (semver.diff(from, to) as string).replace("pre", "");
  return part === "major" || part === "minor" ? part : "patch";
}
