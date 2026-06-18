import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { checkLaravelArchitecture, buildLaravelGraph } from "../../../../../app/modules/architecture/application/analyzers/laravelAnalyzer.js";

function buildConfig(phpExtensions: string[]): ArchitectureConfig {
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
      ignoredPaths: [],
      phpExtensions,
      forbiddenImports: { Domain: [], Application: [], Presentation: [], Infrastructure: [] },
      coupling,
    },
    react: {
      modulesPath: "resources/js/react/modules",
      alias: "@modules",
      layers: {},
      forbiddenImports: {},
      coupling,
    },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

function fakeReader(files: string[]): SourceTreeReader {
  return {
    listDirectories: (dir) => (dir === "app/modules" ? ["app/modules/Users"] : []),
    walkFiles: (_dir, extensions) => files.filter((file) => extensions.some((ext) => file.endsWith(ext))),
    readText: () => "<?php\n",
    isFile: () => false,
  };
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
