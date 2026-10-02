import { describe, expect, it } from "vitest";

import { buildArchitectureGraph } from "../../../../../app/modules/architecture/application/buildArchitectureGraph.js";
import { checkArchitecture } from "../../../../../app/modules/architecture/application/checkArchitecture.js";
import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

// mc en miniatura: admin incluye un archivo de web que vuelve a incluir admin (ciclo entre modulos).
const SOURCES: Record<string, string> = {
  "/mc/admin/index.php": `<?php\ninclude "../web/shared.php";\nrequire_once(_LIB_DIR . 'util.inc');\ninclude "menu.php";\n`,
  "/mc/admin/menu.php": "<?php",
  "/mc/web/shared.php": `<?php include_once(__DIR__ . '/../admin/index.php');`,
  "/mc/web/lib/util.inc": "<?php",
};

const reader: SourceTreeReader = {
  listDirectories: (dir) => (dir === "/mc" ? ["/mc/admin", "/mc/web"] : []),
  walkFiles: (dir, extensions) => Object.keys(SOURCES).filter((file) => file.startsWith(`${dir}/`) && extensions.some((ext) => file.endsWith(ext))),
  readText: (file) => SOURCES[file],
  isFile: (file) => file in SOURCES,
};

const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
const config = (laravel: Partial<ArchitectureConfig["laravel"]> = {}): ArchitectureConfig => ({
  laravel: { modulesPath: "/mc", namespaceRoot: "App", layers: [], ignoredPaths: [], phpExtensions: [".php", ".inc"], forbiddenImports: {}, coupling, ...laravel },
  react: { modulesPath: "/js", alias: "@m", layers: {}, ignoredPaths: [], forbiddenImports: {}, coupling },
  server: { host: "127.0.0.1", port: 4590 },
});

describe("grafo de laravel con includes", () => {
  it("cada include resuelto es un edge import entre archivos y alimenta ciclos y resumen", () => {
    const graph = buildArchitectureGraph(config(), reader);
    const includes = graph.edges.filter((edge) => edge.type === "import");

    expect(includes.map((edge) => [edge.source, edge.target, edge.label, edge.import, edge.line, edge.crossModule])).toEqual([
      ["file:admin/index.php", "file:web/shared.php", "shared.php", '"../web/shared.php"', 2, true],
      ["file:admin/index.php", "file:admin/menu.php", "menu.php", '"menu.php"', 4, false],
      ["file:web/shared.php", "file:admin/index.php", "index.php", "(__DIR__ . '/../admin/index.php')", 1, true],
    ]);
    expect(new Set(includes.map((edge) => edge.id)).size).toBe(3);
    expect(graph.summary.includes).toEqual({ total: 4, resolved: 3, external: 0, unresolved: 1, unresolvedConstants: [{ name: "_LIB_DIR", count: 1 }] });
    expect(graph.summary.cross_module_edges).toBe(2);
    expect(graph.health?.summary).toMatchObject({ cycles: 1, crossModuleImports: 2 });
  });

  it("includeConstants e includePaths de la config se usan al resolver", () => {
    const graph = buildArchitectureGraph(config({ includeConstants: { _LIB_DIR: "/mc/web/lib/" } }), reader);

    expect(graph.summary.includes).toMatchObject({ resolved: 4, unresolved: 0, unresolvedConstants: [] });

    const viaPath = buildArchitectureGraph(config({ includeConstants: { _LIB_DIR: "" }, includePaths: ["/mc/web/lib"] }), reader);
    expect(viaPath.summary.includes).toMatchObject({ resolved: 4 });
  });

  it("el check de laravel trae el ciclo de includes y react no tiene resumen de includes", () => {
    expect(checkArchitecture(config(), reader).cycles?.[0]).toMatchObject({ files: ["admin/index.php", "web/shared.php"], file: "/mc/admin/index.php", crossModule: true });
    expect(buildArchitectureGraph(config(), reader, { target: "react" }).summary.includes).toBeUndefined();
  });
});
