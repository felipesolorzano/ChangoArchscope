import path from "node:path";

import { minimatch } from "minimatch";
import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { checkLaravelArchitecture, buildLaravelGraph } from "../../../../../app/modules/architecture/application/analyzers/laravelAnalyzer.js";

function buildConfig(phpExtensions: string[], ignoredPaths: string[] = []): ArchitectureConfig {
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
      modulesPath: "app/modules",
      namespaceRoot: "App\\Modules",
      layers: ["Domain", "Application", "Presentation", "Infrastructure"],
      ignoredPaths,
      phpExtensions,
      forbiddenImports: { Domain: [], Application: [], Presentation: [], Infrastructure: [] },
      coupling,
    },
    react: {
      modulesPath: "resources/js/react/modules",
      alias: "@modules",
      layers: {},
      ignoredPaths: [],
      forbiddenImports: {},
      coupling,
    },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

function fakeReader(files: string[]): SourceTreeReader {
  return {
    listDirectories: (dir) => (dir === "app/modules" ? ["app/modules/Users"] : []),
    walkFiles: (dir, extensions, ignoredPaths = []) =>
      files.filter(
        (file) =>
          extensions.some((ext) => file.endsWith(ext)) &&
          !ignoredPaths.some((pattern) => minimatch(relativePosix(dir, file), pattern)),
      ),
    readText: () => "<?php\n",
    isFile: () => false,
  };
}

function relativePosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

describe("checkLaravelArchitecture", () => {
  it("solo escanea .php cuando phpExtensions esta en su default", () => {
    const reader = fakeReader(["app/modules/Users/Domain/User.php", "app/modules/Users/Domain/legacy.inc"]);

    const result = checkLaravelArchitecture(buildConfig([".php"]), reader);

    expect(result.summary.files_scanned).toBe(1);
  });

  it("escanea .inc ademas de .php cuando phpExtensions lo incluye", () => {
    const reader = fakeReader(["app/modules/Users/Domain/User.php", "app/modules/Users/Domain/legacy.inc"]);

    const result = checkLaravelArchitecture(buildConfig([".php", ".inc"]), reader);

    expect(result.summary.files_scanned).toBe(2);
  });

  it("escanea archivos .lib.inc cuando .inc esta configurado (comparten la misma extension final)", () => {
    const reader = fakeReader(["app/modules/Users/Domain/Helper.lib.inc"]);

    const result = checkLaravelArchitecture(buildConfig([".php", ".inc"]), reader);

    expect(result.summary.files_scanned).toBe(1);
  });

  it("con phpExtensions [.lib.inc] solo escanea .lib.inc y no los .inc simples", () => {
    const reader = fakeReader(["app/modules/Users/Domain/Helper.lib.inc", "app/modules/Users/Domain/legacy.inc"]);

    const result = checkLaravelArchitecture(buildConfig([".lib.inc"]), reader);

    expect(result.summary.files_scanned).toBe(1);
  });

  it("excluye archivos PHP cuyo path coincide con config.laravel.ignoredPaths", () => {
    const reader = fakeReader(["app/modules/Users/Domain/User.php", "app/modules/Users/vendor/Lib.php"]);

    const result = checkLaravelArchitecture(buildConfig([".php"], ["**/vendor/**"]), reader);

    expect(result.summary.files_scanned).toBe(1);
  });
});

describe("buildLaravelGraph", () => {
  it("incluye nodos de archivos .inc cuando phpExtensions lo incluye", () => {
    const reader = fakeReader(["app/modules/Users/Domain/legacy.inc"]);

    const graph = buildLaravelGraph(buildConfig([".php", ".inc"]), reader);

    expect(graph.nodes.some((node) => node.path === "Users/Domain/legacy.inc")).toBe(true);
  });

  it("no incluye archivos .inc cuando phpExtensions esta en su default", () => {
    const reader = fakeReader(["app/modules/Users/Domain/legacy.inc"]);

    const graph = buildLaravelGraph(buildConfig([".php"]), reader);

    expect(graph.nodes.some((node) => node.path === "Users/Domain/legacy.inc")).toBe(false);
  });
});
