import { describe, expect, it } from "vitest";
import { filterArchitectureGraph } from "../../../../../modules/architecture-explorer/presentation/utils/filterArchitectureGraph";
import type { ArchitectureGraph } from "../../../../../modules/architecture-explorer/domain/value-objects/ArchitectureGraph";

const graph: ArchitectureGraph = {
  generated_at: "2026-01-01T00:00:00.000Z",
  summary: {
    modules: 1,
    nodes: 3,
    edges: 1,
    cross_module_edges: 0,
  },
  nodes: [
    { id: "module:A", type: "module", label: "A", module: "A", layer: null, path: "A", role: "module", role_label: "Module" },
    { id: "file:A/domain/Thing.ts", type: "file", label: "Thing.ts", module: "A", layer: "Domain", path: "A/domain/Thing.ts", role: "value_object", role_label: "Value Object" },
    { id: "file:A/presentation/View.tsx", type: "file", label: "View.tsx", module: "A", layer: "Presentation", path: "A/presentation/View.tsx", role: "page", role_label: "Page" },
    { id: "module:B", type: "module", label: "B", module: "B", layer: null, path: "B", role: "module", role_label: "Module" },
    { id: "file:B/presentation/View.tsx", type: "file", label: "View.tsx", module: "B", layer: "Presentation", path: "B/presentation/View.tsx", role: "page", role_label: "Page" },
  ],
  edges: [
    {
      id: "contains:module:A:file:A/domain/Thing.ts",
      source: "module:A",
      target: "file:A/domain/Thing.ts",
      type: "contains",
      label: "contains",
      crossModule: false,
    },
    {
      id: "imports:file:A/domain/Thing.ts:file:A/presentation/View.tsx",
      source: "file:A/domain/Thing.ts",
      target: "file:A/presentation/View.tsx",
      type: "import",
      label: "View",
      import: "../presentation/View",
      line: 3,
      crossModule: false,
    },
    {
      id: "contains:module:B:file:B/presentation/View.tsx",
      source: "module:B",
      target: "file:B/presentation/View.tsx",
      type: "contains",
      label: "contains",
      crossModule: false,
    },
  ],
};

const baseGraph = (): ArchitectureGraph => ({ ...graph, nodes: [], edges: [] });
const nodeOf = (id: string, module: string, layer: "Domain" | null, path: string, label = id) =>
  ({ id, type: "file", label, module, layer, path, role: null, role_label: null }) as ArchitectureGraph["nodes"][number];

describe("filterArchitectureGraph", () => {
  it("returns an empty graph when no graph is loaded", () => {
    expect(filterArchitectureGraph(null, {
      focusedNodeId: null,
      selectedModule: "",
      selectedLayer: "",
      query: "",
    })).toEqual({ nodes: [], edges: [] });
  });

  it("filters by selected layer while preserving module nodes", () => {
    const result = filterArchitectureGraph(graph, {
      focusedNodeId: null,
      selectedModule: "",
      selectedLayer: "Domain",
      query: "",
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["module:A", "file:A/domain/Thing.ts", "module:B"]);
    expect(result.edges).toHaveLength(1);
  });

  it("focuses a node and keeps only connected edges", () => {
    const result = filterArchitectureGraph(graph, {
      focusedNodeId: "file:A/domain/Thing.ts",
      selectedModule: "",
      selectedLayer: "",
      query: "",
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      "module:A",
      "file:A/domain/Thing.ts",
      "file:A/presentation/View.tsx",
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "contains:module:A:file:A/domain/Thing.ts",
      "imports:file:A/domain/Thing.ts:file:A/presentation/View.tsx",
    ]);
  });

  it("filters by module and query using trimmed case-insensitive text", () => {
    const result = filterArchitectureGraph(graph, {
      focusedNodeId: null,
      selectedModule: "A",
      selectedLayer: "",
      query: "  view  ",
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["file:A/presentation/View.tsx"]);
    expect(result.edges).toEqual([]);
  });

  it("returns no results when query casing does not normalize correctly", () => {
    const result = filterArchitectureGraph(graph, {
      focusedNodeId: null,
      selectedModule: "A",
      selectedLayer: "",
      query: "THING",
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["file:A/domain/Thing.ts"]);
  });

  it("un foco que no existe en el grafo se ignora y aplica el filtro normal", () => {
    const graph = { ...baseGraph(), nodes: [nodeOf("a", "Users", "Domain", "A.ts"), nodeOf("b", "Users", "Domain", "B.ts")], edges: [] };

    expect(filterArchitectureGraph(graph, { focusedNodeId: "ghost", selectedModule: "", selectedLayer: "", query: "" }).nodes).toHaveLength(2);
  });

  it("un nodo enfocado sin edges queda solo", () => {
    const graph = { ...baseGraph(), nodes: [nodeOf("a", "Users", "Domain", "A.ts"), nodeOf("b", "Users", "Domain", "B.ts")], edges: [] };

    expect(filterArchitectureGraph(graph, { focusedNodeId: "a", selectedModule: "", selectedLayer: "", query: "" }).nodes.map((node) => node.id)).toEqual(["a"]);
  });

  it("la busqueda coincide por label o por path (cualquiera de los dos)", () => {
    const graph = {
      ...baseGraph(),
      nodes: [nodeOf("label", "Users", "Domain", "x/one.ts", "UserService"), nodeOf("path", "Users", "Domain", "users/two.ts", "Two")],
      edges: [],
    };

    expect(filterArchitectureGraph(graph, { focusedNodeId: null, selectedModule: "", selectedLayer: "", query: "userservice" }).nodes.map((node) => node.id)).toEqual(["label"]);
    expect(filterArchitectureGraph(graph, { focusedNodeId: null, selectedModule: "", selectedLayer: "", query: "users/" }).nodes.map((node) => node.id)).toEqual(["path"]);
  });
});
