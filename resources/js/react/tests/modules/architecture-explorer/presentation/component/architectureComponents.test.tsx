import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ArchitectureProviders } from "../../../../../modules/architecture-explorer/application/contracts/ArchitectureProviders";
import type { ArchitectureCheck } from "../../../../../modules/architecture-explorer/domain/value-objects/ArchitectureCheck";
import type { ArchitectureGraph, ArchitectureGraphNode } from "../../../../../modules/architecture-explorer/domain/value-objects/ArchitectureGraph";
import { ArchitectureNodeCard } from "../../../../../modules/architecture-explorer/infrastructure/react-flow/ArchitectureNodeCard";
import { ArchitectureCanvas, minimapNodeColor } from "../../../../../modules/architecture-explorer/presentation/components/ArchitectureCanvas";
import { ArchitectureCheckModal } from "../../../../../modules/architecture-explorer/presentation/components/ArchitectureCheckModal";
import { ArchitectureSidebar } from "../../../../../modules/architecture-explorer/presentation/components/ArchitectureSidebar";
import { ArchitectureHealthPanel } from "../../../../../modules/architecture-explorer/presentation/components/ArchitectureHealthPanel";
import { Stat } from "../../../../../modules/architecture-explorer/presentation/components/Stat";
import ArchitectureExplorer from "../../../../../modules/architecture-explorer/presentation/pages/ArchitectureExplorer";

const html = (element: JSX.Element) => renderToStaticMarkup(element);
const noop = () => {};
const fileNode = (over: Partial<ArchitectureGraphNode> = {}): ArchitectureGraphNode => ({
  id: "file:Users/domain/User.ts",
  type: "file",
  label: "User.ts",
  module: "Users",
  layer: "Domain",
  path: "Users/domain/User.ts",
  role_label: "Value Object",
  ...over,
});

describe("Stat", () => {
  it("label y valor", () => {
    expect(html(<Stat label="Nodos" value={42} />)).toBe("<div><span>Nodos</span><strong>42</strong></div>");
  });
});

describe("ArchitectureNodeCard", () => {
  const card = (data: ArchitectureGraphNode) => html(<ReactFlowProvider><ArchitectureNodeCard {...({ id: data.id, data } as never)} /></ReactFlowProvider>);

  it("archivo: label, modulo / capa, rol y clase de capa", () => {
    const markup = card(fileNode());

    expect(markup).toContain("User.ts");
    expect(markup).toContain("Users / Domain");
    expect(markup).toContain("Value Object");
    expect(markup).toContain("architecture-node-domain");
  });

  it("modulo y archivo sin capa ni rol", () => {
    expect(card(fileNode({ type: "module", layer: null, role_label: null }))).toContain(">Module<");
    expect(card(fileNode({ type: "module", layer: null, role_label: null }))).toContain("architecture-node-module");
    const plain = card(fileNode({ layer: null, role_label: null }));
    expect(plain).toContain("Users / File");
    expect(plain).toContain("architecture-node-file");
    expect(plain).not.toContain("architecture-node__role");
  });
});

describe("ArchitectureCanvas", () => {
  const base = {
    sidebarOpen: true,
    loading: false,
    error: null,
    nodes: [],
    edges: [],
    onOpenSidebar: noop,
    onInit: noop,
    onNodesChange: noop,
    onNodeClick: noop,
    onNodeDragStop: noop,
  };

  it("boton Panel solo con el sidebar cerrado", () => {
    expect(html(<ArchitectureCanvas {...base} />)).not.toContain("Abrir panel lateral");
    expect(html(<ArchitectureCanvas {...base} sidebarOpen={false} />)).toContain("Abrir panel lateral");
  });

  it("carga, error y lienzo", () => {
    expect(html(<ArchitectureCanvas {...base} loading />)).toContain("Cargando grafo...");
    expect(html(<ArchitectureCanvas {...base} error="sin config" />)).toContain("sin config");
    expect(html(<ArchitectureCanvas {...base} />)).toContain("react-flow");
  });
});

describe("minimapNodeColor", () => {
  it("color por capa, modulo aparte, archivo sin capa y gris por defecto", () => {
    expect(minimapNodeColor(fileNode({ layer: "Domain" }))).toBe("#12b981");
    expect(minimapNodeColor(fileNode({ type: "module", layer: null }))).toBe("#f8fafc");
    expect(minimapNodeColor(fileNode({ layer: null }))).toBe("#94a3b8");
    expect(minimapNodeColor(fileNode({ layer: "Otra" as never }))).toBe("#94a3b8");
  });
});

describe("ArchitectureCheckModal", () => {
  const result: ArchitectureCheck = {
    checked_at: "2026-01-01T00:00:00.000Z",
    module: null,
    fail_on_coupling: true,
    passed: false,
    summary: { modules: 2, files_scanned: 10, violations_count: 1, couplings_count: 0 },
    reports: [
      {
        module: "components",
        module_path: "/m/components",
        passed: false,
        files_scanned: 7,
        violations_count: 1,
        couplings_count: 0,
        violations: [
          {
            module: "components",
            layer: "Presentation",
            file: "/m/components/cart.js",
            line: 10,
            import: "../pages/prices",
            message: "depende de una pagina",
            suggestion: "",
            target_module: "pages",
            recommendation: "extraer la tabla",
          },
        ],
        couplings: [],
      },
      { module: "pages", module_path: "/m/pages", passed: true, files_scanned: 3, violations_count: 0, couplings_count: 0, violations: [], couplings: [] },
    ],
  };
  const base = { result: null, loading: false, error: null, selectedModule: "", onClose: noop, onRefresh: noop };

  it("titulo y modulo (o todos)", () => {
    expect(html(<ArchitectureCheckModal {...base} />)).toContain("Todos los módulos");
    expect(html(<ArchitectureCheckModal {...base} selectedModule="pages" />)).toContain(">pages<");
    expect(html(<ArchitectureCheckModal {...base} />)).toContain("Architecture check");
  });

  it("carga y error", () => {
    expect(html(<ArchitectureCheckModal {...base} loading />)).toContain("Ejecutando check...");
    expect(html(<ArchitectureCheckModal {...base} error="fallo" />)).toContain("fallo");
  });

  it("resultado: estado, metricas, reportes y listas de issues", () => {
    const markup = html(<ArchitectureCheckModal {...base} result={result} />);

    expect(markup).toContain(">REVISAR<");
    for (const label of ["Módulos", "Archivos", "Violaciones", "Acoplamientos"]) expect(markup).toContain(label);
    expect(markup).toContain("7 archivos revisados");
    expect(markup).toContain("Presentation -&gt; pages");
    expect(markup).toContain("/m/components/cart.js:10");
    expect(markup).toContain("depende de una pagina");
    expect(markup).toContain("../pages/prices");
    expect(markup).toContain("extraer la tabla");
    expect(markup).toContain("Sin hallazgos");
    expect(markup).toContain("architecture-check-report--pass");
  });

  it("PASS cuando el check pasa", () => {
    expect(html(<ArchitectureCheckModal {...base} result={{ ...result, passed: true }} />)).toContain(">PASS<");
  });
});

describe("ArchitectureSidebar", () => {
  const graph: ArchitectureGraph = {
    generated_at: "t",
    summary: { modules: 2, nodes: 3, edges: 1, cross_module_edges: 1 },
    nodes: [fileNode()],
    edges: [],
  } as ArchitectureGraph;
  const base = {
    graph: null,
    modules: ["Users", "Orders"],
    filteredGraph: { nodes: [fileNode()], edges: [] },
    selectedModule: "",
    selectedLayer: "",
    query: "",
    focusedNode: null,
    selectedNode: null,
    onClose: noop,
    onModuleChange: noop,
    onLayerChange: noop,
    onQueryChange: noop,
    onClearFocus: noop,
    onRefresh: noop,
    onOpenCheck: noop,
  };

  it("controles: modulos, capas, busqueda y acciones", () => {
    const markup = html(<ArchitectureSidebar {...base} />);

    expect(markup).toContain(">Orders<");
    expect(markup).toContain(">Presentation<");
    expect(markup).toContain("Actualizar");
    expect(markup).toContain("Check");
    expect(markup).not.toContain("architecture-stats");
    expect(markup).not.toContain("Conexiones de");
    expect(markup).not.toContain("architecture-inspector");
  });

  it("metricas con grafo, foco e inspector cuando corresponden", () => {
    const markup = html(<ArchitectureSidebar {...base} graph={graph} focusedNode={fileNode()} selectedNode={fileNode()} />);

    expect(markup).toContain("Cross-module");
    expect(markup).toContain("Conexiones de");
    expect(markup).toContain("architecture-inspector");
    expect(markup).toContain("Users/domain/User.ts");
  });
});

describe("ArchitectureExplorer", () => {
  it("al montar muestra el sidebar y el estado de carga", () => {
    const dependencies: ArchitectureProviders = {
      graphProvider: { getGraph: () => new Promise(() => {}) },
      checkProvider: { getArchitectureCheck: () => new Promise(() => {}) },
    };
    const markup = html(<ArchitectureExplorer dependencies={dependencies} target="react" />);

    expect(markup).toContain("Architecture Explorer");
    expect(markup).toContain("Cargando grafo...");
  });
});

describe("ArchitectureHealthPanel", () => {
  const cycle = (path: string[], crossModule: boolean) => ({ files: [...new Set(path)].sort(), path, modules: [], crossModule, line: 1 });
  const health = (cycles: ReturnType<typeof cycle>[]) => ({
    summary: { files: 10, imports: 20, crossModuleImports: 581, modulePairs: 12, cycles: cycles.length, filesInCycles: 3, largestCycle: 2 },
    cycles,
    mostImported: Array.from({ length: 7 }, (_, index) => ({ path: `globals/g${index}.js`, module: "globals", count: 150 - index })),
    mostImporting: [],
  });
  const graphWith = (h: ReturnType<typeof health> | undefined) => ({ generated_at: "t", summary: { modules: 1, nodes: 0, edges: 0, cross_module_edges: 0 }, nodes: [], edges: [], health: h }) as ArchitectureGraph;

  it("sin health no renderiza", () => {
    expect(html(<ArchitectureHealthPanel graph={graphWith(undefined)} />)).toBe("");
  });

  it("KPIs, ciclos (entre modulos marcados) y los 5 mas importados", () => {
    const markup = html(<ArchitectureHealthPanel graph={graphWith(health([cycle(["pages/a.js", "globals/b.js", "pages/a.js"], true), cycle(["x.js", "x.js"], false)]))} />);

    expect(markup).toContain("Salud");
    expect(markup).toMatch(/Ciclos.*2/);
    expect(markup).toContain("Imports entre módulos");
    expect(markup).toContain(">581<");
    expect(markup).toContain("Pares de módulos");
    expect(markup).toMatch(/architecture-health__cycle architecture-health__cycle--cross" title="pages\/a.js → globals\/b.js → pages\/a.js">a.js → b.js → a.js</);
    expect(markup).toMatch(/class="architecture-health__cycle" title="x.js → x.js">x.js → x.js</);
    expect(markup).toContain("Más importados");
    expect(markup).toContain("globals/g0.js · 150");
    expect(markup).toContain("globals/g4.js · 146");
    expect(markup).not.toContain("globals/g5.js");
    expect(markup).not.toContain("Sin ciclos");
    expect(markup).not.toContain("más<");
  });

  it("sin ciclos lo dice en verde; con mas de 8 muestra 8 y cuantos faltan", () => {
    expect(html(<ArchitectureHealthPanel graph={graphWith(health([]))} />)).toContain('class="architecture-health__ok">Sin ciclos de imports ✓');

    const many = Array.from({ length: 11 }, (_, index) => cycle([`f${index}.js`, `f${index}.js`], false));
    const markup = html(<ArchitectureHealthPanel graph={graphWith(health(many))} />);
    expect(markup.match(/architecture-health__cycle"/g)).toHaveLength(8);
    expect(markup).toContain("+3 más");
  });

  it("el sidebar lo muestra cuando el grafo trae health", () => {
    const sidebarBase = {
      modules: [],
      filteredGraph: { nodes: [], edges: [] },
      selectedModule: "",
      selectedLayer: "",
      query: "",
      focusedNode: null,
      selectedNode: null,
      onClose: noop,
      onModuleChange: noop,
      onLayerChange: noop,
      onQueryChange: noop,
      onClearFocus: noop,
      onRefresh: noop,
      onOpenCheck: noop,
    };

    expect(html(<ArchitectureSidebar {...sidebarBase} graph={graphWith(health([]))} />)).toContain("Sin ciclos de imports");
  });
});
