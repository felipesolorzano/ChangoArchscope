import { beforeEach, describe, expect, it } from "vitest";

import { toArchitectureGraph, type ArchitectureGraphDto } from "../../../../../modules/architecture-explorer/application/dtos/ArchitectureGraphDto";
import { useArchitectureFocusStore } from "../../../../../modules/architecture-explorer/presentation/store/architectureFocusStore";
import { cycleLabel, nodeIdForPath } from "../../../../../modules/architecture-explorer/presentation/utils/architectureHealthView";
import type { ArchitectureGraphNode } from "../../../../../modules/architecture-explorer/domain/value-objects/ArchitectureGraph";

const node = (id: string, type: "file" | "module", path: string): ArchitectureGraphNode => ({ id, type, label: path, module: "M", layer: null, path });

describe("nodeIdForPath", () => {
  it("id del archivo con ese path; un modulo con el mismo path no cuenta; sin coincidencia null", () => {
    const nodes = [node("module:Users", "module", "Users"), node("file:react:Users", "file", "Users"), node("file:a", "file", "a.js")];

    expect(nodeIdForPath(nodes, "a.js")).toBe("file:a");
    expect(nodeIdForPath(nodes, "Users")).toBe("file:react:Users");
    expect(nodeIdForPath([node("module:Users", "module", "Users")], "Users")).toBeNull();
    expect(nodeIdForPath(nodes, "nope.js")).toBeNull();
  });
});

describe("cycleLabel", () => {
  it("nombres de archivo del recorrido unidos por flechas", () => {
    expect(cycleLabel({ files: [], path: ["pages/a.js", "globals/b.js", "pages/a.js"], modules: [], crossModule: true, line: 1 })).toBe("a.js → b.js → a.js");
    expect(cycleLabel({ files: [], path: ["x.js", "x.js"], modules: [], crossModule: false, line: 1 })).toBe("x.js → x.js");
  });
});

describe("toArchitectureGraph", () => {
  const dto: ArchitectureGraphDto = { generated_at: "t", summary: { modules: 0, nodes: 0, edges: 0, cross_module_edges: 0 }, nodes: [], edges: [] };

  it("copia summary, nodos y edges (como copias nuevas)", () => {
    const node = { id: "file:a", type: "file" as const, label: "a", module: "M", layer: null, path: "a.js", role: null, role_label: null };
    const edgeDto = { id: "e", source: "file:a", target: "file:b", type: "import" as const, label: "b", crossModule: true };
    const full = { ...dto, summary: { modules: 1, nodes: 2, edges: 3, cross_module_edges: 4 }, nodes: [node], edges: [edgeDto] };
    const graph = toArchitectureGraph(full);

    expect(graph).toEqual({ generated_at: "t", summary: { modules: 1, nodes: 2, edges: 3, cross_module_edges: 4 }, nodes: [node], edges: [edgeDto] });
    expect(graph.nodes[0]).not.toBe(node);
    expect(graph.edges[0]).not.toBe(edgeDto);
  });

  it("copia el resumen de includes si viene y lo omite si no", () => {
    const includes = { total: 3, resolved: 2, external: 0, unresolved: 1, unresolvedConstants: [] };

    expect(toArchitectureGraph({ ...dto, summary: { ...dto.summary, includes } }).summary.includes).toEqual(includes);
    expect("includes" in toArchitectureGraph(dto).summary).toBe(false);
  });

  it("copia health si viene y lo omite si no", () => {
    const health = { summary: { files: 1, imports: 0, crossModuleImports: 0, modulePairs: 0, cycles: 0, filesInCycles: 0, largestCycle: 0 }, cycles: [], mostImported: [], mostImporting: [] };

    expect(toArchitectureGraph({ ...dto, health }).health).toEqual(health);
    expect("health" in toArchitectureGraph(dto)).toBe(false);
  });
});

describe("architectureFocusStore", () => {
  beforeEach(() => useArchitectureFocusStore.setState({ focusedNodeId: null }));

  it("guarda el foco y el snapshot de servidor es el estado actual", () => {
    useArchitectureFocusStore.getState().setFocusedNodeId("file:a");

    expect(useArchitectureFocusStore.getState().focusedNodeId).toBe("file:a");
    expect((useArchitectureFocusStore as unknown as { getServerState: () => { focusedNodeId: string } }).getServerState().focusedNodeId).toBe("file:a");
  });
});
