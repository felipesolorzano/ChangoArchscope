import path from "node:path";

import { minimatch } from "minimatch";
import { describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { buildReactGraph, checkReactArchitecture } from "../../../../../app/modules/architecture/application/analyzers/reactAnalyzer.js";

function relativePosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

function buildConfig(ignoredPaths: string[] = []): ArchitectureConfig {
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
      layers: [],
      ignoredPaths: [],
      phpExtensions: [".php"],
      forbiddenImports: {},
      coupling,
    },
    react: {
      modulesPath: "resources/js/react/modules",
      alias: "@modules",
      layers: { domain: "Domain" },
      ignoredPaths,
      forbiddenImports: {},
      coupling,
    },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

function fakeReader(files: string[]): SourceTreeReader {
  return {
    listDirectories: (dir) =>
      dir === "resources/js/react/modules" ? ["resources/js/react/modules/Users"] : [],
    walkFiles: (dir, extensions, ignoredPaths = []) =>
      files.filter(
        (file) =>
          extensions.some((ext) => file.endsWith(ext)) &&
          !ignoredPaths.some((pattern) => minimatch(relativePosix(dir, file), pattern)),
      ),
    readText: () => "",
    isFile: () => false,
  };
}

describe("buildReactGraph", () => {
  it("excluye archivos cuyo path coincide con config.react.ignoredPaths", () => {
    const reader = fakeReader([
      "resources/js/react/modules/Users/domain/User.ts",
      "resources/js/react/modules/Users/__tests__/User.test.ts",
    ]);

    const graph = buildReactGraph(buildConfig(["**/__tests__/**"]), reader);

    expect(graph.nodes.some((node) => node.path === "Users/__tests__/User.test.ts")).toBe(false);
    expect(graph.nodes.some((node) => node.path === "Users/domain/User.ts")).toBe(true);
  });
});

describe("checkReactArchitecture", () => {
  it("no escanea archivos cuyo path coincide con config.react.ignoredPaths", () => {
    const reader = fakeReader([
      "resources/js/react/modules/Users/domain/User.ts",
      "resources/js/react/modules/Users/__tests__/User.test.ts",
    ]);

    const result = checkReactArchitecture(buildConfig(["**/__tests__/**"]), reader);

    expect(result.summary.files_scanned).toBe(1);
  });
});

describe("checkReactArchitecture con react.folderOrder (arbol plano)", () => {
  const root = "/src";
  const sources: Record<string, string> = {
    "/src/pages/page.home.js": "import Card from '../components/card';\n",
    "/src/components/card.js": "import React from 'react';\nimport Home from '../pages/page.home';\n",
    "/src/globals/global.js": "import cfg from '../configs/config';\n",
    "/src/configs/config.js": "",
  };

  function flatConfig(folderOrder: Array<string | string[]>): ArchitectureConfig {
    const config = buildConfig();
    return { ...config, react: { ...config.react, modulesPath: root, layers: {}, folderOrder } };
  }

  const flatReader: SourceTreeReader = {
    listDirectories: (dir) => (dir === root ? ["/src/pages", "/src/components", "/src/globals", "/src/configs"] : []),
    walkFiles: (dir) => Object.keys(sources).filter((file) => file.startsWith(`${dir}/`)),
    readText: (file) => sources[file],
    isFile: (file) => file in sources,
  };

  it("reporta como violacion un import hacia una carpeta de mas arriba", () => {
    const result = checkReactArchitecture(flatConfig(["pages", "components", "globals"]), flatReader);

    const violations = result.reports.flatMap((report) => report.violations);
    expect(violations).toEqual([
      {
        module: "components",
        layer: null,
        file: "/src/components/card.js",
        line: 2,
        import: "../pages/page.home",
        message: 'La carpeta "components" depende de "pages", que esta por encima en react.folderOrder.',
        suggestion: "Mover lo compartido a una carpeta inferior o invertir la dependencia (props, callbacks, contexto).",
        target_module: "pages",
      },
    ]);
    expect(result.summary.violations_count).toBe(1);
    expect(result.passed).toBe(false);
  });

  it("sin folderOrder no hay violaciones en un arbol plano", () => {
    const result = checkReactArchitecture(flatConfig([]), flatReader);

    expect(result.summary.violations_count).toBe(0);
  });

  it("carpetas fuera del orden se ignoran (components y configs no estan)", () => {
    const result = checkReactArchitecture(flatConfig(["pages", "globals"]), flatReader);

    expect(result.reports.flatMap((report) => report.violations)).toEqual([]);
  });
});

