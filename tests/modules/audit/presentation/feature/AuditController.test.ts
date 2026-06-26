import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { ArchitectureCheckResult } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureCheckReport.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../../../../app/modules/audit/domain/repositories/PhpSourceParser.js";
import { AuditController } from "../../../../../app/modules/audit/presentation/http/AuditController.js";

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
      ignoredPaths: ["**/vendor/**"],
      phpExtensions: [".php", ".inc"],
      forbiddenImports: {},
      coupling,
    },
    react: {
      modulesPath: "/abs/react/modules",
      alias: "@modules",
      layers: {},
      ignoredPaths: [],
      forbiddenImports: {},
      coupling,
    },
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

// reader/parser que SI producen un finding nativo (security) si se escanea PHP,
// para distinguir el caso laravel (escanea) del react (no escanea).
const reader: SourceTreeReader = {
  listDirectories: () => [],
  walkFiles: () => ["app/modules/Users/Domain/User.php"],
  readText: () => "<?php\n",
  isFile: () => true,
};

const parser: PhpSourceParser = {
  parse: (file) => ({
    file,
    classes: [],
    functions: [],
    referencedNames: [],
    securityIssues: [{ rule: "eval-usage", line: 1 }],
    sqlLiterals: [],
  }),
};

function fakeResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json, response: { status } as unknown as Response };
}

describe("AuditController", async () => {
  it("responde 200 con el AuditSnapshot del target/module derivados del query", async () => {
    const check = vi.fn((_config, _reader, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditController({ getConfig: buildConfig, reader, parser, check });
    const { status, json, response } = fakeResponse();
    const next = vi.fn();

    await controller.show(
      { query: { target: "react", module: "Billing" } } as unknown as Request,
      response,
      next as unknown as NextFunction,
    );

    expect(check).toHaveBeenCalledWith(buildConfig(), reader, { target: "react", module: "Billing" });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledTimes(1);
    expect(json.mock.calls[0][0]).toMatchObject({ target: "react", module: "Billing" });
    expect(next).not.toHaveBeenCalled();
  });

  it("con target react no escanea PHP: el snapshot no trae findings nativos", async () => {
    const check = vi.fn((_config, _reader, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show(
      { query: { target: "react" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    const snapshot = json.mock.calls[0][0] as { findings: Array<{ source: string }> };
    expect(snapshot.findings.some((finding) => finding.source === "native")).toBe(false);
  });

  it("con target laravel escanea PHP usando modulesPath: el snapshot trae findings nativos", async () => {
    const check = vi.fn((_config, _reader, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditController({ getConfig: buildConfig, reader, parser, check });
    const { json, response } = fakeResponse();

    await controller.show({ query: {} } as unknown as Request, response, vi.fn() as unknown as NextFunction);

    expect(check).toHaveBeenCalledWith(buildConfig(), reader, { target: "laravel", module: null });
    const snapshot = json.mock.calls[0][0] as { target: string; module: string | null; findings: Array<{ source: string; category: string }> };
    expect(snapshot).toMatchObject({ target: "laravel", module: null });
    expect(snapshot.findings.some((finding) => finding.source === "native" && finding.category === "security")).toBe(true);
  });

  it("trata un module vacio en el query como null", async () => {
    const check = vi.fn((_config, _reader, options: { target: string; module: string | null }) =>
      checkResult(options.target, options.module),
    );
    const controller = new AuditController({ getConfig: buildConfig, reader, parser, check });
    const { response } = fakeResponse();

    await controller.show(
      { query: { module: "" } } as unknown as Request,
      response,
      vi.fn() as unknown as NextFunction,
    );

    expect(check).toHaveBeenCalledWith(buildConfig(), reader, { target: "laravel", module: null });
  });

  it("delega el error a next sin responder cuando algo falla", async () => {
    const boom = new Error("config no registrada");
    const getConfig = () => {
      throw boom;
    };
    const controller = new AuditController({ getConfig, reader, parser, check: vi.fn() });
    const { status, response } = fakeResponse();
    const next = vi.fn();

    await controller.show({ query: {} } as unknown as Request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(boom);
    expect(status).not.toHaveBeenCalled();
  });
});
