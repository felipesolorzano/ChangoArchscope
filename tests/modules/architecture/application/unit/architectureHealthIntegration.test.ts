import { describe, expect, it } from "vitest";

import { buildArchitectureGraph } from "../../../../../app/modules/architecture/application/buildArchitectureGraph.js";
import { checkArchitecture } from "../../../../../app/modules/architecture/application/checkArchitecture.js";
import type { ArchitectureConfig } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

// Proyecto React con un ciclo entre modulos: Users/a → Billing/b → Users/a.
const ROOT = "/m";
const SOURCES: Record<string, string> = {
  "/m/Users/a.ts": 'import { b } from "../Billing/b";\n',
  "/m/Billing/b.ts": 'import { c } from "./c";\nimport { a } from "../Users/a";\n',
  "/m/Billing/c.ts": "",
};

const reader: SourceTreeReader = {
  listDirectories: (dir) => (dir === ROOT ? ["/m/Billing", "/m/Users"] : []),
  walkFiles: (dir) => Object.keys(SOURCES).filter((file) => file.startsWith(`${dir}/`)),
  readText: (file) => SOURCES[file],
  isFile: (file) => file in SOURCES,
};

const coupling = { enabled: false, message: "x", suggestion: "x", defaultAssessment: "x", defaultRecommendation: "x", defaultAction: "x" };
const config: ArchitectureConfig = {
  laravel: { modulesPath: "/php", namespaceRoot: "App", layers: [], ignoredPaths: [], phpExtensions: [".php"], forbiddenImports: {}, coupling },
  react: { modulesPath: ROOT, alias: "@modules", layers: {}, ignoredPaths: [], forbiddenImports: {}, coupling },
  server: { host: "127.0.0.1", port: 4590 },
};

describe("salud de arquitectura en el grafo y el check", () => {
  it("/graph.json trae health con el ciclo y los rankings", () => {
    const graph = buildArchitectureGraph(config, reader, { target: "react" });

    expect(graph.health?.summary).toMatchObject({ files: 3, imports: 3, cycles: 1, filesInCycles: 2, largestCycle: 2 });
    expect(graph.health?.cycles[0]).toMatchObject({ files: ["Billing/b.ts", "Users/a.ts"], crossModule: true, modules: ["Billing", "Users"] });
  });

  it("el check trae los ciclos con la ruta absoluta del primer archivo; laravel sin imports no tiene", () => {
    const result = checkArchitecture(config, reader, { target: "react" });

    expect(result.cycles).toEqual([
      { files: ["Billing/b.ts", "Users/a.ts"], path: ["Billing/b.ts", "Users/a.ts", "Billing/b.ts"], modules: ["Billing", "Users"], crossModule: true, line: 2, file: "/m/Billing/b.ts" },
    ]);
    expect(checkArchitecture(config, reader, { target: "laravel" }).cycles).toEqual([]);
    expect(result).toMatchObject({ target: "react", fail_on_coupling: true });
  });

  it("sin opciones el grafo y el check son de laravel", () => {
    expect(buildArchitectureGraph(config, reader).health?.summary.files).toBe(0);
    expect(checkArchitecture(config, reader)).toMatchObject({ target: "laravel", fail_on_coupling: true, cycles: [] });
    expect(checkArchitecture(config, reader, { target: "react", failOnCoupling: false }).fail_on_coupling).toBe(false);
  });
});
