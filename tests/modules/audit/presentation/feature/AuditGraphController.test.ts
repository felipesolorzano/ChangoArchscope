import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
import { AuditGraphController } from "../../../../../app/modules/audit/presentation/http/AuditGraphController.js";

function buildConfig(): ArchitectureConfig {
  const coupling = {
    enabled: false,
    message: "x",
    suggestion: "x",
    defaultAssessment: "x",
    defaultRecommendation: "x",
    defaultAction: "x",
  };

  return {
    laravel: {
      modulesPath: "/abs/app/modules",
      namespaceRoot: "App\\Modules",
      layers: [],
      ignoredPaths: [],
      phpExtensions: [".php"],
      forbiddenImports: {},
      coupling,
    },
    react: { modulesPath: "/abs/react", alias: "@modules", layers: {}, ignoredPaths: [], forbiddenImports: {}, coupling },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

function checkResult(target: string, module: string | null): ArchitectureCheckResult {
  return {
    checked_at: "2026-01-01T00:00:00.000Z",
    target,
    module,
    fail_on_coupling: true,
    passed: true,
    summary: { modules: 0, files_scanned: 0, violations_count: 0, couplings_count: 0 },
    reports: [],
  };
}

const reader: SourceTreeReader = {
  listDirectories: () => [],
  walkFiles: () => [],
  readText: () => "",
  isFile: () => false,
};

const parser: PhpSourceParser = {
  parse: () => ({ file: "", classes: [], functions: [], referencedNames: [], securityIssues: [], sqlLiterals: [] }),
};

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json, response: { status } as unknown as Response };
}

describe("AuditGraphController", async () => {
  it("responde 200 con el AuditGraph (view overview) derivado del snapshot", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { status, json, response } = fakeResponse();
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(check).toHaveBeenCalledWith(buildConfig(), reader, { target: "laravel", module: null });
    expect(status).toHaveBeenCalledWith(200);
    const graph = json.mock.calls[0][0] as { view: string; nodes: unknown[] };
    expect(graph.view).toBe("overview");
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it("deriva target/module/view/focus del query", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { target: "react", module: "Billing", view: "overview", focus: "admin" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(check).toHaveBeenCalledWith(buildConfig(), reader, { target: "react", module: "Billing" });
    const graph = json.mock.calls[0][0] as { focus: string | null };
    expect(graph.focus).toBe("admin");
  });

  it("con view=app y focus arma la vista de drill-down (view app)", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { view: "app", focus: "admin" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    const graph = json.mock.calls[0][0] as { view: string; focus: string | null };
    expect(graph.view).toBe("app");
    expect(graph.focus).toBe("admin");
  });

  it("con view=file y focus arma la vista de reglas (view file)", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { view: "file", focus: "admin/X.php" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect((json.mock.calls[0][0] as { view: string }).view).toBe("file");
  });

  it("con view=heatmap arma el mapa de calor global (view heatmap)", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show({ query: { view: "heatmap" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect((json.mock.calls[0][0] as { view: string }).view).toBe("heatmap");
  });

  it("con target react no hay phpRoot, asi que un view=app cae a overview", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { target: "react", view: "app", focus: "admin" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect((json.mock.calls[0][0] as { view: string }).view).toBe("overview");
  });

  it("delega el error a next sin responder cuando algo falla", async () => {
    const boom = new Error("config no registrada");
    const controller = new AuditGraphController({
      getConfig: () => {
        throw boom;
      },
      reader,
      parser,
      check: vi.fn(),
    });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(boom);
    expect(status).not.toHaveBeenCalled();
  });
});
