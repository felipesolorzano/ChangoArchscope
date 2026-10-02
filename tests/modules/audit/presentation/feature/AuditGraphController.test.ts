import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
import type { JsSourceParser } from "../../../../../app/modules/audit/domain/repositories/JsSourceParser.js";
import { AuditGraphController } from "../../../../../app/modules/audit/presentation/http/AuditGraphController.js";
import { AuditHealthController } from "../../../../../app/modules/audit/presentation/http/AuditHealthController.js";

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

  it("con target react usa react.modulesPath como raiz: view=app hace drill", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { target: "react", view: "app", focus: "pages" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(json.mock.calls[0][0]).toMatchObject({ view: "app", focus: "pages" });
  });

  it.each([
    {
      target: "laravel",
      file: "/abs/app/modules/admin/X.php",
      focus: "admin",
      expected: "file:admin/X.php",
    },
    {
      target: "react",
      file: "/abs/react/pages/a.js",
      focus: "pages",
      expected: "file:pages/a.js",
    },
  ])("el drill de $target ubica los archivos relativos a la raiz de su stack", async ({ target, file, focus, expected }) => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const scanningReader: SourceTreeReader = { ...reader, walkFiles: () => [file], readText: () => "" };
    const phpParser: PhpSourceParser = {
      parse: (path) => ({ file: path, classes: [], functions: [], referencedNames: [], securityIssues: [{ rule: "eval-usage", line: 1 }], sqlLiterals: [] }),
    };
    const jsParser: JsSourceParser = {
      parse: (path) => ({
        file: path,
        linesCount: 1,
        classes: [],
        functions: [],
        imports: [],
        securityIssues: [{ rule: "eval-usage", line: 1 }],
        httpCalls: [],
        globalAccesses: [],
      }),
    };
    const controller = new AuditGraphController({ getConfig: buildConfig, reader: scanningReader, parser: phpParser, check, jsParser });
    const { json, response } = fakeResponse();

    await controller.show({ query: { target, view: "app", focus } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    const graph = json.mock.calls[0][0] as { nodes: Array<{ id: string }> };
    expect(graph.nodes.map((node) => node.id)).toEqual([`app:${focus}`, expected]);
  });

  it.each(["bogus", undefined, ["app"]])("un view no reconocido (%s) cae a overview", async (view) => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditGraphController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show({ query: { view, focus: "admin" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

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

describe("AuditHealthController", () => {
  it("responde la salud del proyecto del target con su raiz", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) => checkResult(options.target, options.module));
    const scanningReader: SourceTreeReader = { ...reader, walkFiles: () => ["/abs/react/pages/a.js"], readText: () => "" };
    const jsParser: JsSourceParser = {
      parse: (path) => ({ file: path, linesCount: 1, classes: [], functions: [], imports: [], securityIssues: [], httpCalls: [], globalAccesses: [] }),
    };
    const controller = new AuditHealthController({ getConfig: buildConfig, reader: scanningReader, parser, check, jsParser });
    const { status, json, response } = fakeResponse();

    await controller.show({ query: { target: "react" } } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(status).toHaveBeenCalledWith(200);
    const health = json.mock.calls[0][0] as { summary: { files: number }; groups: Array<{ key: string }> };
    expect(health.summary.files).toBe(1);
    expect(health.groups.map((group) => group.key)).toEqual(["pages"]);
  });

  it("con laravel agrupa respecto de la raiz PHP", async () => {
    const check = vi.fn((_c, _r, options: { target: string; module: string | null }) => checkResult(options.target, options.module));
    const scanningReader: SourceTreeReader = { ...reader, walkFiles: () => ["/abs/app/modules/admin/X.php"], readText: () => "" };
    const phpParser: PhpSourceParser = {
      parse: (path) => ({ file: path, classes: [], functions: [], referencedNames: [], securityIssues: [], sqlLiterals: [] }),
    };
    const controller = new AuditHealthController({ getConfig: buildConfig, reader: scanningReader, parser: phpParser, check });
    const { json, response } = fakeResponse();

    await controller.show({ query: {} } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect((json.mock.calls[0][0] as { groups: Array<{ key: string }> }).groups.map((group) => group.key)).toEqual(["admin"]);
  });

  it("delega el error a next", async () => {
    const boom = new Error("x");
    const controller = new AuditHealthController({ getConfig: () => { throw boom; }, reader, parser, check: vi.fn() });
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, fakeResponse().response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(boom);
  });
});

