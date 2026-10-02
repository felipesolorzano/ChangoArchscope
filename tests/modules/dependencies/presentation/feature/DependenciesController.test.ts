import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import { DependenciesController } from "../../../../../app/modules/dependencies/presentation/http/DependenciesController.js";

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

function respond(target: unknown) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn() as NextFunction;
  const controller = new DependenciesController({ getConfig: () => config, reader, probe: { versionOf: () => null } });

  controller.show({ query: { target } } as unknown as Request, response, next);

  return { json, response, next };
}

describe("DependenciesController", () => {
  it("inventaria el stack laravel con su raiz e ignoredPaths", () => {
    const { json, response } = respond("laravel");

    expect(response.status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toMatchObject({ root: "/php", manifests: ["/php/composer.json"], dependencies: [{ name: "a/b" }] });
  });

  it("react usa su raiz; un target desconocido cae a laravel", () => {
    expect(respond("react").json.mock.calls[0][0]).toMatchObject({ root: "/js", dependencies: [{ name: "react" }] });
    expect(respond("vue").json.mock.calls[0][0]).toMatchObject({ root: "/php" });
  });

  it("un error inesperado va a next", () => {
    const next = vi.fn() as NextFunction;
    const broken = new DependenciesController({
      getConfig: () => {
        throw new Error("boom");
      },
      reader,
      probe: { versionOf: () => null },
    });

    broken.show({ query: {} } as unknown as Request, { status: vi.fn() } as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
