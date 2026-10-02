import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import { createAuditSnapshotCache } from "../../../../../app/modules/audit/application/use-cases/AuditSnapshotCache.js";
import {
  phpVersionFromQuery,
  resolveAuditSnapshot,
  type AuditControllerDeps,
} from "../../../../../app/modules/audit/presentation/http/auditRequest.js";

describe("phpVersionFromQuery", () => {
  it.each(["8.3", "7.4", "18.10"])("acepta %s", (value) => {
    expect(phpVersionFromQuery(value)).toBe(value);
  });

  it.each(["8", "8.3.1", "x8.3", "8.3x", "a.3", "8.b", "", "8..3"])("rechaza %s", (value) => {
    expect(phpVersionFromQuery(value)).toBeNull();
  });

  it.each([8.3, undefined, null, ["8.3"]])("rechaza un valor que no es string (%s)", (value) => {
    expect(phpVersionFromQuery(value)).toBeNull();
  });
});

function config(): ArchitectureConfig {
  const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
  return {
    laravel: { modulesPath: "/php", namespaceRoot: "App", layers: [], ignoredPaths: [], phpExtensions: [".php"], forbiddenImports: {}, coupling },
    react: { modulesPath: "/react", alias: "@modules", layers: {}, ignoredPaths: [], forbiddenImports: {}, coupling },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

function checkResult(target: string, module: string | null): ArchitectureCheckResult {
  return {
    checked_at: "t",
    target,
    module,
    fail_on_coupling: true,
    passed: true,
    summary: { modules: 0, files_scanned: 0, violations_count: 0, couplings_count: 0 },
    reports: [],
  };
}

function deps(overrides: Partial<AuditControllerDeps> = {}): AuditControllerDeps {
  return {
    getConfig: config,
    reader: { listDirectories: () => [], walkFiles: () => [], readText: () => "", isFile: () => false },
    parser: { parse: vi.fn() },
    check: vi.fn((_config, _reader, options) => checkResult(options.target, options.module)),
    ...overrides,
  };
}

describe("resolveAuditSnapshot — compatibilidad PHP", () => {
  const scan = () => vi.fn(async (_root: string, targetPhp: string) => ({ status: "ok" as const, targetPhp, issues: [] }));

  it("con laravel y version pide el scan con raiz, version, extensiones y fingerprint", async () => {
    const resolveCompatibility = scan();
    const snapshot = await resolveAuditSnapshot(deps({ resolveCompatibility, fingerprint: async () => "fp" }), "laravel", null, "8.3");

    expect(resolveCompatibility).toHaveBeenCalledWith("/php", "8.3", [".php"], "fp");
    expect(snapshot.summary.scanners?.php_compatibility).toEqual({ status: "ok", targetPhp: "8.3" });
  });

  it("sin version no pide el scan", async () => {
    const resolveCompatibility = scan();
    await resolveAuditSnapshot(deps({ resolveCompatibility }), "laravel", null, null);

    expect(resolveCompatibility).not.toHaveBeenCalled();
  });

  it("con react no pide el scan aunque haya version", async () => {
    const resolveCompatibility = scan();
    await resolveAuditSnapshot(deps({ resolveCompatibility }), "react", null, "8.3");

    expect(resolveCompatibility).not.toHaveBeenCalled();
  });

  it("sin scanner inyectado la categoria queda skipped", async () => {
    const snapshot = await resolveAuditSnapshot(deps(), "laravel", null, "8.3");

    expect(snapshot.summary.scanners?.php_compatibility).toEqual({ status: "skipped" });
  });
});

describe("resolveAuditSnapshot — react.testPaths", () => {
  const jsParser = {
    parse: (file: string) => ({ file, linesCount: 1, classes: [], functions: [], imports: [], securityIssues: [], httpCalls: [], globalAccesses: [] }),
  };
  const withTests = (): ArchitectureConfig => ({ ...config(), react: { ...config().react, testPaths: ["/react-tests"] } });

  it("escanea los testPaths con las extensiones JS y sin ignoredPaths", async () => {
    const walkFiles = vi.fn(() => []);
    await resolveAuditSnapshot(
      deps({ getConfig: withTests, jsParser, reader: { listDirectories: () => [], walkFiles, readText: () => "", isFile: () => false } }),
      "react",
      null,
    );

    expect(walkFiles).toHaveBeenCalledWith("/react-tests", [".ts", ".tsx", ".js", ".jsx"], []);
  });

  it("el fingerprint combina la raiz y cada testPath: cambiar un test invalida el cache", async () => {
    let testsFp = "t1";
    const fingerprint = vi.fn(async (root: string) => (root === "/react-tests" ? testsFp : "src"));
    const d = deps({ getConfig: withTests, jsParser, fingerprint, snapshotCache: createAuditSnapshotCache() });

    await resolveAuditSnapshot(d, "react", null);
    await resolveAuditSnapshot(d, "react", null);
    testsFp = "t2";
    await resolveAuditSnapshot(d, "react", null);

    expect(fingerprint).toHaveBeenCalledWith("/react-tests", [".ts", ".tsx", ".js", ".jsx"], []);
    expect(d.check).toHaveBeenCalledTimes(2);
  });
});

describe("resolveAuditSnapshot — fingerprint combinado", () => {
  it("las huellas se separan: (ab, c) y (a, bc) no colisionan", async () => {
    const jsParser = {
      parse: (file: string) => ({ file, linesCount: 1, classes: [], functions: [], imports: [], securityIssues: [], httpCalls: [], globalAccesses: [] }),
    };
    let prints = { src: "ab", tests: "c" };
    const fingerprint = vi.fn(async (root: string) => (root === "/react-tests" ? prints.tests : prints.src));
    const d = deps({
      getConfig: () => ({ ...config(), react: { ...config().react, testPaths: ["/react-tests"] } }),
      jsParser,
      fingerprint,
      snapshotCache: createAuditSnapshotCache(),
    });

    await resolveAuditSnapshot(d, "react", null);
    prints = { src: "a", tests: "bc" };
    await resolveAuditSnapshot(d, "react", null);

    expect(d.check).toHaveBeenCalledTimes(2);
  });
});

describe("resolveAuditSnapshot — cache", () => {
  it("con fingerprint pero sin snapshotCache computa siempre", async () => {
    const d = deps({ fingerprint: async () => "fp" });

    await resolveAuditSnapshot(d, "laravel", null);
    await resolveAuditSnapshot(d, "laravel", null);

    expect(d.check).toHaveBeenCalledTimes(2);
  });

  it("module y version distintos son entradas distintas del cache; iguales reusan", async () => {
    const d = deps({ fingerprint: async () => "fp", snapshotCache: createAuditSnapshotCache() });

    await resolveAuditSnapshot(d, "laravel", "A", null);
    await resolveAuditSnapshot(d, "laravel", "B", null);
    await resolveAuditSnapshot(d, "laravel", "A", "8.3");
    await resolveAuditSnapshot(d, "laravel", "A", "8.2");
    await resolveAuditSnapshot(d, "laravel", "A", "8.2");
    await resolveAuditSnapshot(d, "laravel", null, null);
    await resolveAuditSnapshot(d, "laravel", null, null);

    expect(d.check).toHaveBeenCalledTimes(5);
  });
});
