import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { LookupCache } from "../../../../../app/modules/dependencies/application/contracts/LookupCache.js";
import { generateDependencyReport, type DependencyReportDeps } from "../../../../../app/modules/dependencies/application/use-cases/generateDependencyReport.js";
import type { PackageInfo } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

const NOW = new Date("2026-10-02T12:00:00.000Z");
const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
const config = {
  laravel: { modulesPath: "/php", namespaceRoot: "App", layers: [], ignoredPaths: [], phpExtensions: [".php"], forbiddenImports: {}, coupling },
  react: { modulesPath: "/js", alias: "@m", layers: {}, ignoredPaths: [], forbiddenImports: {}, coupling },
  server: { host: "127.0.0.1", port: 4590 },
} as ArchitectureConfig;

const files: Record<string, string> = {
  "/js/.git/HEAD": "",
  "/js/package.json": JSON.stringify({ dependencies: { react: "^18.0.0", write: "^1.0.0" } }),
  "/js/src/a.js": `import React from "react";`,
};

const reader: SourceTreeReader = {
  listDirectories: (dir) => (dir === "/js" ? ["/js/.git"] : []),
  walkFiles: (root, extensions) => Object.keys(files).filter((file) => file.startsWith(`${root}/`) && extensions.some((ext) => file.endsWith(ext)) && !file.includes("/.git/")),
  readText: (file) => files[file],
  isFile: (file) => file in files,
};

function memory<T>(rows: Record<string, { value: T; fetchedAt: string }> = {}): LookupCache<T> {
  return { get: (key) => rows[key] ?? null, set: (key, value, fetchedAt) => void (rows[key] = { value, fetchedAt }) };
}

const info = (name: string): PackageInfo => ({ ecosystem: "npm", name, abandoned: null, releases: [{ version: "18.0.0", deprecated: null, requires: {}, publishedAt: null }] });

function deps(): DependencyReportDeps {
  const registryRows = new Map<string, { info: PackageInfo | null; fetchedAt: string }>([["npm:react", { info: info("react"), fetchedAt: "2026-01-01T00:00:00.000Z" }]]);
  return {
    getConfig: () => config,
    reader,
    probe: { versionOf: () => "20.0.0" },
    registry: { fetch: vi.fn(async (_e, name) => info(name)) },
    cache: { get: (e, n) => registryRows.get(`${e}:${n}`) ?? null, set: (e, n, value, fetchedAt) => void registryRows.set(`${e}:${n}`, { info: value, fetchedAt }) },
    advisories: { fetch: vi.fn(async () => []) },
    advisoryCache: memory(),
    calendar: { fetch: vi.fn(async () => null) },
    calendarCache: memory(),
    now: () => NOW,
  };
}

describe("generateDependencyReport", () => {
  it("detecta, consulta, mide el uso y arma el reporte", async () => {
    const d = deps();
    const report = await generateDependencyReport(d, { target: "react", requested: {}, refresh: false, offline: false });

    expect(report.generatedAt).toBe(NOW.toISOString());
    expect(report.dependencies.map((dependency) => [dependency.name, dependency.usage?.files, dependency.usage?.unused])).toEqual([
      ["react", 1, false],
      ["write", 0, true],
    ]);
    expect(d.registry.fetch).toHaveBeenCalledTimes(2);
    expect(d.advisories.fetch).toHaveBeenCalledTimes(2);
    expect(d.calendar.fetch).toHaveBeenCalledWith("nodejs");
  });

  it("offline no toca la red: usa lo cacheado (aunque este vencido) y lo demas queda sin datos", async () => {
    const d = deps();
    const report = await generateDependencyReport(d, { target: "react", requested: {}, refresh: true, offline: true });

    expect(d.registry.fetch).not.toHaveBeenCalled();
    expect(d.advisories.fetch).not.toHaveBeenCalled();
    expect(d.calendar.fetch).not.toHaveBeenCalled();
    expect(report.dependencies[0]).toMatchObject({ name: "react", latest: "18.0.0", stale: true, lookupError: null });
    expect(report.dependencies[1]).toMatchObject({ name: "write", status: "unknown", lookupError: "sin datos en cache" });
  });
});
