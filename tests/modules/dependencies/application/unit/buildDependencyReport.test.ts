import { describe, expect, it } from "vitest";

import { buildDependencyReport } from "../../../../../app/modules/dependencies/application/use-cases/buildDependencyReport.js";
import type { PackageLookup } from "../../../../../app/modules/dependencies/application/use-cases/resolvePackageInfos.js";
import type { Lookup } from "../../../../../app/modules/dependencies/application/use-cases/resolveCachedLookups.js";
import { usageKey } from "../../../../../app/modules/dependencies/application/use-cases/measureUsage.js";
import type { Usage } from "../../../../../app/modules/dependencies/domain/services/packageUsage.js";
import type { Advisory, SupportCycle } from "../../../../../app/modules/dependencies/domain/value-objects/Security.js";
import type { DeclaredDependency, DependencyInventory, PackageInfo } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";

const dep = (name: string, installed: string): DeclaredDependency => ({ ecosystem: "npm", name, constraint: "^1.0.0", installed, dev: false, manifest: "/p/package.json" });

const inventory: DependencyInventory = {
  root: "/p/src",
  manifests: ["/p/package.json"],
  skipped: [{ manifest: "/p/bad/package.json", reason: "JSON" }],
  runtimes: [
    { kind: "node", version: "16.0.0", source: "local" },
    { kind: "npm", version: null, source: "desconocido" },
  ],
  dependencies: [dep("lib", "1.0.0"), dep("ghost", "1.0.0"), dep("broken", "1.0.0"), dep("unlisted", "1.0.0")],
};

const lib: PackageInfo = {
  ecosystem: "npm",
  name: "lib",
  abandoned: null,
  releases: [
    { version: "1.0.0", deprecated: null, requires: {}, publishedAt: null },
    { version: "2.0.0", deprecated: null, requires: { node: ">=14", npm: ">=6" }, publishedAt: null },
    { version: "3.0.0", deprecated: null, requires: { node: ">=18" }, publishedAt: null },
  ],
};

const lookups = new Map<string, PackageLookup>([
  ["npm:lib", { info: lib, fetchedAt: "2026-10-02T00:00:00.000Z", error: null, stale: false }],
  ["npm:ghost", { info: null, fetchedAt: "2026-10-02T00:00:00.000Z", error: null, stale: false }],
  ["npm:broken", { info: lib, fetchedAt: "2026-09-01T00:00:00.000Z", error: "timeout", stale: true }],
]);

const noAdvisories = new Map<string, Lookup<Advisory[]>>();
const noCalendars = new Map<string, Lookup<SupportCycle[] | null>>();

const noUsage = new Map<string, Usage>();

const build = (requested = {}, advisories = noAdvisories, calendars = noCalendars, usage = noUsage) =>
  buildDependencyReport({ inventory, lookups, requested, generatedAt: "2026-10-02T12:00:00.000Z", advisories, calendars, today: "2026-10-02", usage });

const lookup = <T,>(value: T, error: string | null = null): Lookup<T> => ({ value, fetchedAt: "2026-10-02T00:00:00.000Z", error, stale: false });

describe("buildDependencyReport", () => {
  it("usa el runtime detectado por default y clasifica con el", () => {
    const report = build();

    expect(report).toMatchObject({ generatedAt: "2026-10-02T12:00:00.000Z", root: "/p/src", manifests: ["/p/package.json"], skipped: inventory.skipped });
    expect(report.runtimes).toEqual([
      { kind: "node", version: "16.0.0", source: "local", selected: "16.0.0", support: null, cycles: [] },
      { kind: "npm", version: null, source: "desconocido", selected: null, support: null, cycles: [] },
    ]);
    expect(report.dependencies[0]).toMatchObject({ name: "lib", recommended: "2.0.0", status: "major", limitedByRuntime: true, fetchedAt: "2026-10-02T00:00:00.000Z", lookupError: null, stale: false });
  });

  it("un runtime sin version (npm desconocido) no restringe la recomendada", () => {
    expect(build().dependencies[0].recommended).toBe("2.0.0");
  });

  it("el runtime pedido (normalizado) reemplaza al detectado; uno invalido o ajeno se ignora", () => {
    const report = build({ node: "v20", npm: "10.2.0", php: "8.3" });

    expect(report.runtimes.map((runtime) => runtime.selected)).toEqual(["20.0.0", "10.2.0"]);
    expect(report.dependencies[0]).toMatchObject({ recommended: "3.0.0", limitedByRuntime: false });
    expect(build({ node: "latest" }).runtimes[0].selected).toBe("16.0.0");
  });

  it("lookupError: error de la consulta, no encontrado o sin lookup", () => {
    const [, ghost, broken, unlisted] = build().dependencies;

    expect(ghost).toMatchObject({ status: "unknown", lookupError: "no encontrado en el registro", stale: false, fetchedAt: "2026-10-02T00:00:00.000Z" });
    expect(broken).toMatchObject({ status: "major", lookupError: "timeout", stale: true });
    expect(unlisted).toMatchObject({ status: "unknown", lookupError: "no encontrado en el registro", fetchedAt: null, stale: false });
  });

  it("resume por estado (los 7), limitados por runtime y errores de consulta", () => {
    expect(build().summary).toEqual({
      total: 4,
      byStatus: { up_to_date: 0, patch: 0, minor: 0, major: 2, deprecated: 0, abandoned: 0, unknown: 2 },
      limitedByRuntime: 2,
      lookupErrors: 3,
      vulnerable: 0,
      bySeverity: { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 },
      endOfLife: 0,
      unused: 0,
      vendored: 0,
    });
  });

  it("las copiadas a mano llevan vendored y se cuentan en el resumen", () => {
    const vendoredInventory = { ...inventory, dependencies: [{ ...dep("jquery", "1.7.1"), vendored: { files: 4 } }, dep("lib", "1.0.0")] };
    const report = buildDependencyReport({ inventory: vendoredInventory, lookups, requested: {}, generatedAt: "", advisories: noAdvisories, calendars: noCalendars, today: "", usage: noUsage });

    expect(report.dependencies[0].vendored).toEqual({ files: 4 });
    expect(report.dependencies[1].vendored).toBeUndefined();
    expect(report.summary.vendored).toBe(1);
  });

  it("agrega uso (null si no se midio), grupo y cuenta los sin uso", () => {
    const usage = new Map<string, Usage>([
      [usageKey(inventory.dependencies[0]), { files: 3, inManifest: false, unused: false }],
      [usageKey(inventory.dependencies[1]), { files: 0, inManifest: false, unused: true }],
      [usageKey(inventory.dependencies[3]), { files: 0, inManifest: false, unused: true }],
    ]);
    const report = build({}, noAdvisories, noCalendars, usage);

    expect(report.dependencies[0]).toMatchObject({ usage: { files: 3, inManifest: false, unused: false }, group: null });
    expect(report.dependencies[1].usage).toEqual({ files: 0, inManifest: false, unused: true });
    expect(report.dependencies[2].usage).toBeNull();
    expect(report.summary.unused).toBe(2);

    const grouped = buildDependencyReport({ inventory: { ...inventory, dependencies: [dep("react-dom", "1.0.0")] }, lookups, requested: {}, generatedAt: "", advisories: noAdvisories, calendars: noCalendars, today: "", usage: noUsage });
    expect(grouped.dependencies[0].group).toBe("react");
  });

  it("agrega vulnerabilidades por paquete, el error de la consulta y el resumen por severidad", () => {
    const advisories = new Map([
      ["npm:lib", lookup<Advisory[]>([{ id: "GHSA-1", aliases: ["CVE-1"], summary: "x", severity: "high", ranges: [{ introduced: "0.0.0", fixed: "1.5.0", lastAffected: null }], versions: [] }])],
      ["npm:broken", lookup<Advisory[]>([{ id: "GHSA-2", aliases: [], summary: "y", severity: "critical", ranges: [{ introduced: "0.0.0", fixed: null, lastAffected: null }], versions: [] }], "osv caido")],
      ["npm:ghost", lookup<Advisory[]>(null as unknown as Advisory[], "timeout")],
    ]);

    const report = build({}, advisories);
    const [lib, ghost, broken, unlisted] = report.dependencies;

    expect(lib.security).toEqual({ vulnerabilities: [{ id: "GHSA-1", cve: "CVE-1", summary: "x", severity: "high", fixedIn: "1.5.0" }], maxSeverity: "high", recommendedAffected: false });
    expect(lib.advisoryError).toBeNull();
    expect(broken.security).toMatchObject({ maxSeverity: "critical", recommendedAffected: true });
    expect(broken.advisoryError).toBe("osv caido");
    expect(ghost.security).toEqual({ vulnerabilities: [], maxSeverity: null, recommendedAffected: false });
    expect(ghost.advisoryError).toBe("timeout");
    expect(unlisted.security.vulnerabilities).toEqual([]);
    expect(unlisted.advisoryError).toBeNull();
    expect(report.summary).toMatchObject({ vulnerable: 2, bySeverity: { critical: 1, high: 1, moderate: 0, low: 0, unknown: 0 } });
  });

  it("soporte de paquetes reconocidos y de runtimes, con sus ciclos", () => {
    const reactInventory: DependencyInventory = {
      ...inventory,
      runtimes: [
        { kind: "node", version: "16.0.0", source: "local" },
        { kind: "npm", version: "10.0.0", source: "local" },
      ],
      dependencies: [{ ...dep("react", "16.14.0"), name: "react" }, dep("lib", "1.0.0")],
    };
    const calendars = new Map<string, Lookup<SupportCycle[] | null>>([
      ["nodejs", lookup<SupportCycle[] | null>([
        { cycle: "22", latest: "22.20.0", releaseDate: null, eol: "2027-04-30", support: null },
        { cycle: "16", latest: "16.20.2", releaseDate: null, eol: "2023-09-11", support: null },
      ])],
      ["react", lookup<SupportCycle[] | null>([{ cycle: "16", latest: "16.14.0", releaseDate: null, eol: true, support: null }])],
    ]);

    const report = buildDependencyReport({ inventory: reactInventory, lookups, requested: {}, generatedAt: "", advisories: noAdvisories, calendars, today: "2026-10-02", usage: noUsage });

    expect(report.runtimes[0]).toMatchObject({
      kind: "node",
      support: { product: "nodejs", cycle: "16", eol: "2023-09-11", isEol: true, latestInCycle: "16.20.2" },
      cycles: [
        { cycle: "22", latest: "22.20.0", eol: "2027-04-30", isEol: false },
        { cycle: "16", latest: "16.20.2", eol: "2023-09-11", isEol: true },
      ],
    });
    expect(report.runtimes[1]).toMatchObject({ kind: "npm", support: null, cycles: [] });
    expect(report.dependencies[0].support).toEqual({ product: "react", cycle: "16", eol: true, isEol: true, latestInCycle: "16.14.0" });
    expect(report.dependencies[1].support).toBeNull();
    expect(report.summary.endOfLife).toBe(1);

    const unknownCalendar = new Map([["nodejs", lookup<SupportCycle[] | null>(null)]]);
    expect(buildDependencyReport({ inventory: reactInventory, lookups, requested: {}, generatedAt: "", advisories: noAdvisories, calendars: unknownCalendar, today: "2026-10-02", usage: noUsage }).runtimes[0]).toMatchObject({ support: null, cycles: [] });
  });
});
