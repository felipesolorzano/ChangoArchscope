import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import { ProtectionController } from "../../../../../app/modules/protection/presentation/http/ProtectionController.js";

const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
const config = {
  laravel: { modulesPath: "/php", namespaceRoot: "App", layers: [], ignoredPaths: [], phpExtensions: [".php"], forbiddenImports: {}, coupling },
  react: { modulesPath: "/js", alias: "@m", layers: {}, ignoredPaths: [], testPaths: ["/js-tests"], forbiddenImports: {}, coupling },
  server: { host: "127.0.0.1", port: 4590 },
} as ArchitectureConfig;

const files: Record<string, string> = { "/js/readme.md": "", "/php/a.php": "", "/php/tests/aTest.php": "", "/js/a.tsx": "", "/js/b.jsx": "", "/js/c.js": "", "/js/d.ts": "", "/js-tests/a.test.tsx": "" };
const reader: SourceTreeReader = {
  listDirectories: () => [],
  walkFiles: (root, extensions) => Object.keys(files).filter((file) => file.startsWith(`${root}/`) && extensions.some((ext) => file.endsWith(ext))),
  readText: (file) => files[file],
  isFile: (file) => file in files,
};

function respond(query: Record<string, unknown>, getConfig = () => config) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn() as NextFunction;
  new ProtectionController({ getConfig, reader }).show({ query } as unknown as Request, response, next);
  return { body: json.mock.calls[0]?.[0], response, next };
}

describe("ProtectionController", () => {
  it("laravel: phpExtensions y sin testPaths; target desconocido cae a laravel", () => {
    expect(respond({ target: "laravel" }).body).toMatchObject({ root: "/php", tests: { testFiles: 1, sourceFiles: 1 }, level: "low" });
    expect(respond({ target: "vue" }).body).toMatchObject({ root: "/php" });
  });

  it("react: extensiones JS/TS y sus testPaths", () => {
    const { body, response } = respond({ target: "react" });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ root: "/js", tests: { testFiles: 1, sourceFiles: 4 } });
  });

  it("un error va a next", () => {
    const { next } = respond({}, () => {
      throw new Error("boom");
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
