import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { AdvisoryDatabase } from "../../../../../app/modules/dependencies/application/contracts/AdvisoryDatabase.js";
import type { LookupCache } from "../../../../../app/modules/dependencies/application/contracts/LookupCache.js";
import type { SupportCalendar } from "../../../../../app/modules/dependencies/application/contracts/SupportCalendar.js";
import type { PackageInfoCache } from "../../../../../app/modules/dependencies/application/contracts/PackageInfoCache.js";
import type { PackageRegistry } from "../../../../../app/modules/dependencies/application/contracts/PackageRegistry.js";
import type { PackageInfo } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";
import { DependenciesController, type DependenciesControllerDeps } from "../../../../../app/modules/dependencies/presentation/http/DependenciesController.js";

const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
const config = {
  laravel: { modulesPath: "/php", namespaceRoot: "App", layers: [], ignoredPaths: ["skip-php/**"], phpExtensions: [".php"], forbiddenImports: {}, coupling },
  react: { modulesPath: "/js", alias: "@m", layers: {}, ignoredPaths: ["skip-js/**"], forbiddenImports: {}, coupling },
  server: { host: "127.0.0.1", port: 4590 },
} as ArchitectureConfig;

const files: Record<string, string> = {
  "/php/.git/HEAD": "",
  "/php/composer.json": JSON.stringify({ require: { "a/b": "^1.0" } }),
  "/php/skip-php/composer.json": JSON.stringify({ require: { "c/d": "^1.0" } }),
  "/js/.git/HEAD": "",
  "/js/package.json": JSON.stringify({ dependencies: { react: "^18.0.0" } }),
};

const reader: SourceTreeReader = {
  listDirectories: (dir) => (Object.keys(files).some((file) => file.startsWith(`${dir}/.git/`)) ? [`${dir}/.git`] : []),
  walkFiles: (root, _extensions, ignoredPaths = []) =>
    Object.keys(files).filter((file) => file.startsWith(`${root}/`) && file.endsWith(".json") && !ignoredPaths.some((pattern) => file.includes(`/${pattern.split("/")[0]}/`))),
  readText: (file) => files[file],
  isFile: (file) => file in files,
};

const NOW = new Date("2026-10-02T12:00:00.000Z");

function memoryLookupCache<T>(): LookupCache<T> {
  const rows = new Map<string, { value: T; fetchedAt: string }>();
  return { get: (key) => rows.get(key) ?? null, set: (key, value, fetchedAt) => void rows.set(key, { value, fetchedAt }) };
}

function controllerWith(overrides: Partial<DependenciesControllerDeps> = {}) {
  const registry: PackageRegistry = {
    fetch: vi.fn(async (ecosystem, name) => ({
      ecosystem,
      name,
      abandoned: null,
      releases: [
        { version: "1.0.0", deprecated: null, requires: {}, publishedAt: null },
        { version: "18.0.0", deprecated: null, requires: { node: ">=20" }, publishedAt: null },
      ],
    })),
  };
  const advisories: AdvisoryDatabase = {
    fetch: vi.fn(async (_ecosystem, name) =>
      name === "react" ? [{ id: "GHSA-r", aliases: ["CVE-9"], summary: "xss", severity: "high" as const, ranges: [{ introduced: "0.0.0", fixed: "18.5.0", lastAffected: null }], versions: [] }] : [],
    ),
  };
  const calendar: SupportCalendar = {
    fetch: vi.fn(async (product) => (product === "nodejs" ? [{ cycle: "16", latest: "16.20.2", releaseDate: null, eol: "2023-09-11", support: null }] : null)),
  };
  const rows = new Map<string, { info: PackageInfo | null; fetchedAt: string }>();
  const cache: PackageInfoCache = { get: (e, n) => rows.get(`${e}:${n}`) ?? null, set: (e, n, info, fetchedAt) => void rows.set(`${e}:${n}`, { info, fetchedAt }) };
  const deps: DependenciesControllerDeps = {
    getConfig: () => config,
    reader,
    probe: { versionOf: () => "16.0.0" },
    registry,
    cache,
    advisories,
    advisoryCache: memoryLookupCache(),
    calendar,
    calendarCache: memoryLookupCache(),
    now: () => NOW,
    ...overrides,
  };

  return { controller: new DependenciesController(deps), registry, advisories, calendar };
}

async function respond(controller: DependenciesController, query: Record<string, unknown>) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn() as NextFunction;

  await controller.show({ query } as unknown as Request, response, next);

  return { json, response, next, body: json.mock.calls[0]?.[0] };
}

describe("DependenciesController", () => {
  it("reporta el stack laravel con su raiz e ignoredPaths", async () => {
    const { controller } = controllerWith();
    const { response, body } = await respond(controller, { target: "laravel" });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ root: "/php", manifests: ["/php/composer.json"], dependencies: [{ name: "a/b", latest: "18.0.0" }] });
    expect(body.generatedAt).toBe(NOW.toISOString());
  });

  it("react usa su raiz; un target desconocido cae a laravel", async () => {
    const { controller } = controllerWith();

    expect((await respond(controller, { target: "react" })).body).toMatchObject({ root: "/js", dependencies: [{ name: "react" }] });
    expect((await respond(controller, { target: "vue" })).body).toMatchObject({ root: "/php" });
  });

  it("pasa node/npm/php pedidos al reporte", async () => {
    const { controller } = controllerWith();

    const detected = (await respond(controller, { target: "react" })).body;
    const chosen = (await respond(controller, { target: "react", node: "20.1.0", npm: "10.0.0", php: "8.2" })).body;

    expect(detected.dependencies[0]).toMatchObject({ recommended: "1.0.0", limitedByRuntime: true });
    expect(chosen.runtimes.map((runtime: { selected: string }) => runtime.selected)).toEqual(["20.1.0", "10.0.0"]);
    expect(chosen.dependencies[0]).toMatchObject({ recommended: "18.0.0", limitedByRuntime: false });
  });

  it("php pedido aplica en laravel; un parametro repetido (array) se ignora", async () => {
    const { controller } = controllerWith();

    expect((await respond(controller, { target: "laravel", php: "7.4" })).body.runtimes[0]).toMatchObject({ kind: "php", selected: "7.4.0" });
    expect((await respond(controller, { target: "react", node: ["20.0.0", "21.0.0"] })).body.runtimes[0]).toMatchObject({ kind: "node", selected: "16.0.0" });
  });

  it("usa la cache entre llamadas y refresh=1 vuelve a consultar registro, OSV y calendario", async () => {
    const { controller, registry, advisories, calendar } = controllerWith();

    await respond(controller, { target: "react" });
    await respond(controller, { target: "react", refresh: "0" });
    expect(registry.fetch).toHaveBeenCalledTimes(1);
    expect(advisories.fetch).toHaveBeenCalledTimes(1);
    expect(calendar.fetch).toHaveBeenCalledTimes(2);

    await respond(controller, { target: "react", refresh: "1" });
    expect(registry.fetch).toHaveBeenCalledTimes(2);
    expect(advisories.fetch).toHaveBeenCalledTimes(2);
    expect(calendar.fetch).toHaveBeenCalledTimes(4);
  });

  it("agrega vulnerabilidades y soporte: calendarios de runtimes y de paquetes reconocidos", async () => {
    const { controller, calendar } = controllerWith();

    const body = (await respond(controller, { target: "react" })).body;

    expect(calendar.fetch).toHaveBeenCalledWith("nodejs");
    expect(calendar.fetch).toHaveBeenCalledWith("react");
    expect(body.dependencies[0].security).toMatchObject({ maxSeverity: "high", vulnerabilities: [{ id: "GHSA-r", cve: "CVE-9", fixedIn: "18.5.0" }] });
    expect(body.runtimes[0]).toMatchObject({ kind: "node", support: { cycle: "16", isEol: true } });
    expect(body.summary).toMatchObject({ vulnerable: 1, endOfLife: 0 });
  });

  it("la cache vence a las 24 h", async () => {
    let now = NOW;
    const { controller, registry } = controllerWith({ now: () => now });

    await respond(controller, { target: "react" });
    now = new Date(NOW.getTime() + 24 * 60 * 60 * 1000 - 1);
    await respond(controller, { target: "react" });
    expect(registry.fetch).toHaveBeenCalledTimes(1);

    now = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await respond(controller, { target: "react" });
    expect(registry.fetch).toHaveBeenCalledTimes(2);
  });

  it("un error inesperado va a next", async () => {
    const { controller } = controllerWith({
      getConfig: () => {
        throw new Error("boom");
      },
    });

    const { next } = await respond(controller, {});

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
