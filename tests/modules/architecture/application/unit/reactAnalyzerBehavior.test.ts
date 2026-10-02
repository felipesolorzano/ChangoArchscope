import { beforeEach, describe, expect, it } from "vitest";

import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";
import type { ArchitectureConfig, CouplingRules } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureConfig.js";
import { buildReactGraph, checkReactArchitecture } from "../../../../../app/modules/architecture/application/analyzers/reactAnalyzer.js";

// Caracterizacion de reactAnalyzer (ver "React: grafo y check en detalle" en architecture-analyzers.md).

const ROOT = "/m";

const SOURCES: Record<string, string> = {
  "/m/Users/domain/value-objects/User.ts": 'import React from "react";\nimport { Api } from "../../infrastructure/api/UserApi";\n',
  "/m/Users/infrastructure/api/UserApi.ts":
    'import { Invoice } from "@modules/Billing/domain/Invoice";\nimport "@modules/Shared";\nimport { Gone } from "@modules/Billing/missing";\n',
  "/m/Users/application/use-cases/createUser.ts":
    'import { Port } from "../../../Billing/application/contracts/BillingPort";\nimport x from "../../../../outside/x";\n',
  "/m/Users/misc.ts": 'import React from "react";\nimport { Invoice } from "@modules/Billing/domain/Invoice";\n',
  "/m/Billing/domain/Invoice.ts": "",
  "/m/Billing/application/contracts/BillingPort.ts": "",
  "/m/Shared/index.ts": "",
  "/outside/x.ts": "",
};

function reader(sources: Record<string, string> = SOURCES, root = ROOT): SourceTreeReader {
  return {
    listDirectories: (dir) =>
      dir === root ? [...new Set(Object.keys(sources).filter((file) => file.startsWith(`${root}/`)).map((file) => `${root}/${file.slice(root.length + 1).split("/")[0]}`))] : [],
    walkFiles: (dir) => Object.keys(sources).filter((file) => file.startsWith(`${dir}/`)),
    readText: (file) => sources[file],
    isFile: (file) => file in sources,
  };
}

const COUPLING: CouplingRules = {
  enabled: true,
  ignoredModules: [],
  allowedDependencies: {},
  message: "acoplado",
  suggestion: "usar contrato",
  defaultAssessment: "revisar",
  defaultRecommendation: "invertir",
  defaultAction: "accion",
};

function config(coupling: Partial<CouplingRules> = {}): ArchitectureConfig {
  return {
    laravel: {
      modulesPath: "/php",
      namespaceRoot: "App",
      layers: [],
      ignoredPaths: [],
      phpExtensions: [".php"],
      forbiddenImports: {},
      coupling: { ...COUPLING, enabled: false },
    },
    react: {
      modulesPath: ROOT,
      alias: "@modules",
      layers: { domain: "Domain", application: "Application", infrastructure: "Infrastructure", presentation: "Presentation" },
      ignoredPaths: [],
      forbiddenImports: {
        Domain: [
          { pattern: "^react$", message: "Domain sin React", suggestion: "mover a presentation" },
          { pattern: "\\/infrastructure\\/", message: "Domain sin infra" },
        ],
      },
      coupling: { ...COUPLING, ...coupling },
    },
    server: { host: "127.0.0.1", port: 4590 },
  };
}

describe("buildReactGraph — nodos y edges", () => {
  // Se construye dentro de cada test (no al cargar el archivo) para que mutation testing lo ejecute
  // con cada mutante activo.
  let graph: ReturnType<typeof buildReactGraph>;
  beforeEach(() => {
    graph = buildReactGraph(config(), reader());
  });
  const node = (id: string) => graph.nodes.find((candidate) => candidate.id === id);
  const importEdges = (source: string) => graph.edges.filter((edge) => edge.type === "import" && edge.source === source);

  it("todos los nodos son nodos completos (id y type)", () => {
    expect(graph.nodes.every((candidate) => typeof candidate.id === "string" && typeof candidate.type === "string")).toBe(true);
  });

  it("un nodo por modulo con su forma completa", () => {
    expect(graph.nodes.filter((candidate) => candidate.type === "module").map((candidate) => candidate.id)).toEqual([
      "module:react:Users",
      "module:react:Billing",
      "module:react:Shared",
    ]);
    expect(node("module:react:Users")).toEqual({
      id: "module:react:Users",
      type: "module",
      label: "Users",
      module: "Users",
      layer: null,
      path: "/m/Users",
      role: "module",
      role_label: "Modulo React",
    });
  });

  it("un nodo por archivo con capa, rol y ruta relativa", () => {
    expect(node("file:react:Users/domain/value-objects/User.ts")).toEqual({
      id: "file:react:Users/domain/value-objects/User.ts",
      type: "file",
      label: "User.ts",
      module: "Users",
      layer: "Domain",
      path: "Users/domain/value-objects/User.ts",
      role: "value_object",
      role_label: "Value Object",
    });
    expect(node("file:react:Users/misc.ts")).toMatchObject({ layer: null, role: null, role_label: null });
  });

  it("edge contains de modulo a archivo", () => {
    expect(graph.edges.find((edge) => edge.target === "file:react:Users/misc.ts" && edge.type === "contains")).toEqual({
      id: "contains:module:react:Users:file:react:Users/misc.ts",
      source: "module:react:Users",
      target: "file:react:Users/misc.ts",
      type: "contains",
      label: "contains",
      crossModule: false,
    });
  });

  it("alias con resto apunta al archivo; sin resto o sin resolver, al modulo", () => {
    const edges = importEdges("file:react:Users/infrastructure/api/UserApi.ts");

    expect(edges.map((edge) => [edge.target, edge.label, edge.import, edge.line, edge.crossModule])).toEqual([
      ["file:react:Billing/domain/Invoice.ts", "Invoice", "@modules/Billing/domain/Invoice", 1, true],
      ["module:react:Shared", "Shared", "@modules/Shared", 2, true],
      ["module:react:Billing", "missing", "@modules/Billing/missing", 3, true],
    ]);
    expect(edges.every((edge) => /^imports:react:[0-9a-f]{32}$/.test(edge.id))).toBe(true);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
  });

  it("relativo dentro de modulesPath resuelve; fuera de modulesPath y paquetes se ignoran", () => {
    expect(importEdges("file:react:Users/application/use-cases/createUser.ts").map((edge) => [edge.target, edge.crossModule])).toEqual([
      ["file:react:Billing/application/contracts/BillingPort.ts", true],
    ]);
    expect(importEdges("file:react:Users/domain/value-objects/User.ts").map((edge) => [edge.target, edge.crossModule])).toEqual([
      ["file:react:Users/infrastructure/api/UserApi.ts", false],
    ]);
  });

  it("no duplica nodos de archivos que son a la vez escaneados y destino", () => {
    const ids = graph.nodes.map((candidate) => candidate.id);

    expect(ids.filter((id) => id === "file:react:Billing/domain/Invoice.ts")).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("summary con modulos, nodos, edges y edges entre modulos", () => {
    expect(graph.summary).toEqual({
      modules: 3,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      cross_module_edges: graph.edges.filter((edge) => edge.crossModule).length,
    });
    expect(graph.summary.cross_module_edges).toBe(5);
    expect(typeof graph.generated_at).toBe("string");
  });

  it("onlyModule (sin distinguir mayusculas) recorre solo ese modulo pero agrega los destinos", () => {
    const only = buildReactGraph(config(), reader(), "users");

    expect(only.summary.modules).toBe(1);
    expect(only.nodes.some((candidate) => candidate.id === "file:react:Billing/application/contracts/BillingPort.ts")).toBe(true);
    expect(only.edges.some((edge) => edge.source.startsWith("file:react:Billing"))).toBe(false);
    expect(only.nodes.find((candidate) => candidate.id === "module:react:Billing")).toMatchObject({ path: "/m/Billing", role: "module" });
    expect(only.nodes.find((candidate) => candidate.id === "file:react:Billing/application/contracts/BillingPort.ts")).toEqual({
      id: "file:react:Billing/application/contracts/BillingPort.ts",
      type: "file",
      label: "BillingPort.ts",
      module: "Billing",
      layer: "Application",
      path: "Billing/application/contracts/BillingPort.ts",
      role: "connector",
      role_label: "Conector",
    });
  });

  it("el nodo de un archivo destino toma su capa", () => {
    expect(node("file:react:Billing/application/contracts/BillingPort.ts")).toMatchObject({ layer: "Application", role: "connector" });
  });
});

describe("buildReactGraph — resolucion de imports (bordes)", () => {
  const edgesOf = (sources: Record<string, string>, alias = "@modules") => {
    const base = config();
    return buildReactGraph({ ...base, react: { ...base.react, alias } }, reader(sources)).edges.filter((edge) => edge.type === "import");
  };

  it("un alias con / final y con caracteres especiales (punto) se respeta literal", () => {
    const sources = {
      "/m/A/x.ts": 'import a from "@my.mods/B/y";\nimport b from "@myXmods/B/y";\n',
      "/m/B/y.ts": "",
    };

    expect(edgesOf(sources, "@my.mods/").map((edge) => edge.target)).toEqual(["file:react:B/y.ts"]);
  });

  it("un alias con varios segmentos solo pierde la / final", () => {
    const sources = { "/m/A/x.ts": 'import a from "@app/mods/B/y";\n', "/m/B/y.ts": "" };

    expect(edgesOf(sources, "@app/mods/").map((edge) => edge.target)).toEqual(["file:react:B/y.ts"]);
  });

  it("un paquete no se resuelve aunque exista un archivo vecino con ese nombre", () => {
    const sources = { "/m/A/x.ts": 'import r from "react";\n', "/m/A/react.ts": "" };

    expect(edgesOf(sources)).toEqual([]);
  });

  it("resuelve imports relativos a .tsx y .jsx", () => {
    const sources = {
      "/m/A/pages/Page.ts": 'import C from "../components/Card";\nimport L from "../components/List";\n',
      "/m/A/components/Card.tsx": "",
      "/m/A/components/List.jsx": "",
    };

    expect(edgesOf(sources).map((edge) => edge.target)).toEqual(["file:react:A/components/Card.tsx", "file:react:A/components/List.jsx"]);
  });
});

describe("buildReactGraph — roles", () => {
  it.each([
    ["Mod/application/use-cases/x.ts", "use_case", "Caso de uso"],
    ["Mod/application/contracts/x.ts", "connector", "Conector"],
    ["Mod/presentation/contracts/x.ts", "connector", "Conector"],
    ["Mod/application/dtos/x.ts", "dto", "DTO"],
    ["Mod/domain/value-objects/x.ts", "value_object", "Value Object"],
    ["Mod/infrastructure/api/x.ts", "adapter", "Adaptador API"],
    ["Mod/infrastructure/react-flow/x.ts", "adapter", "React Flow"],
    ["Mod/presentation/components/x.tsx", "ui_component", "Componente UI"],
    ["Mod/interfaces/components/x.tsx", "ui_component", "Componente UI"],
    ["Mod/presentation/pages/x.tsx", "page", "Pagina"],
    ["Mod/interfaces/pages/x.tsx", "page", "Pagina"],
    ["Mod/presentation/hooks/x.ts", "hook", "Hook UI"],
    ["Mod/interfaces/hooks/x.ts", "hook", "Hook UI"],
    ["Mod/infrastructure/factory/x.ts", "infrastructure", "Infrastructure"],
    ["Mod/other/x.ts", null, null],
  ])("%s -> %s", (relative, role, roleLabel) => {
    const withRoot = buildReactGraph({ ...config(), react: { ...config().react, modulesPath: "/r" } }, reader({ [`/r/${relative}`]: "" }, "/r"));

    expect(withRoot.nodes.find((candidate) => candidate.type === "file")).toMatchObject({ role, role_label: roleLabel });
  });
});

describe("checkReactArchitecture", () => {
  const all = (result: ReturnType<typeof checkReactArchitecture>, kind: "violations" | "couplings") =>
    result.reports.flatMap((report) => report[kind]);

  it("imports prohibidos por capa, con mensaje y sugerencia de la regla", () => {
    const violations = all(checkReactArchitecture(config({ enabled: false }), reader()), "violations");

    expect(violations).toEqual([
      {
        module: "Users",
        layer: "Domain",
        file: "/m/Users/domain/value-objects/User.ts",
        line: 1,
        import: "react",
        message: "Domain sin React",
        suggestion: "mover a presentation",
      },
      {
        module: "Users",
        layer: "Domain",
        file: "/m/Users/domain/value-objects/User.ts",
        line: 2,
        import: "../../infrastructure/api/UserApi",
        message: "Domain sin infra",
        suggestion: "",
      },
    ]);
  });

  it("un archivo sin capa no recibe forbidden imports ni coupling", () => {
    const result = checkReactArchitecture(config(), reader());

    expect([...all(result, "violations"), ...all(result, "couplings")].some((issue) => issue.file === "/m/Users/misc.ts")).toBe(false);
  });

  it("coupling hacia otros modulos con los textos de la config", () => {
    const couplings = all(checkReactArchitecture(config(), reader()), "couplings");

    expect(couplings.map((issue) => [issue.file.split("/").pop(), issue.target_module, issue.line])).toEqual([
      ["UserApi.ts", "Billing", 1],
      ["UserApi.ts", "Shared", 2],
      ["UserApi.ts", "Billing", 3],
      ["createUser.ts", "Billing", 1],
    ]);
    expect(couplings[0]).toEqual({
      module: "Users",
      layer: "Infrastructure",
      file: "/m/Users/infrastructure/api/UserApi.ts",
      line: 1,
      import: "@modules/Billing/domain/Invoice",
      message: "acoplado",
      suggestion: "usar contrato",
      target_module: "Billing",
      assessment: "revisar",
      recommendation: "invertir",
      action: "accion",
    });
  });

  it("ignoredModules, allowedDependencies por modulo y comodin * excluyen couplings", () => {
    const targets = (rules: Partial<CouplingRules>) =>
      all(checkReactArchitecture(config(rules), reader()), "couplings").map((issue) => issue.target_module);

    expect(targets({ ignoredModules: ["Shared"] })).toEqual(["Billing", "Billing", "Billing"]);
    expect(targets({ allowedDependencies: { Users: ["Billing"] } })).toEqual(["Shared"]);
    expect(targets({ allowedDependencies: { "*": ["Shared"] } })).toEqual(["Billing", "Billing", "Billing"]);
    expect(targets({ ignoredModules: undefined, allowedDependencies: undefined })).toHaveLength(4);
  });

  it("coupling desactivado no reporta acoplamientos", () => {
    expect(all(checkReactArchitecture(config({ enabled: false }), reader()), "couplings")).toEqual([]);
  });

  it("failOnCoupling (default true) marca fallido; con false, solo los couplings no fallan", () => {
    const onlyCouplings: Record<string, string> = {
      "/m/Users/application/a.ts": 'import x from "@modules/Billing/domain/Invoice";\n',
      "/m/Billing/domain/Invoice.ts": "",
    };

    expect(checkReactArchitecture(config(), reader(onlyCouplings)).passed).toBe(false);
    expect(checkReactArchitecture(config(), reader(onlyCouplings), null, false).passed).toBe(true);
  });

  it("onlyModule filtra los reportes y el resultado es target react", () => {
    const result = checkReactArchitecture(config(), reader(), "BILLING");

    expect(result.target).toBe("react");
    expect(result.module).toBe("BILLING");
    expect(result.reports.map((report) => report.module)).toEqual(["Billing"]);
  });
});
