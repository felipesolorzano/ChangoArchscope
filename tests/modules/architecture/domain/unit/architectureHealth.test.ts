import { describe, expect, it } from "vitest";

import { architectureHealth } from "../../../../../app/modules/architecture/domain/services/architectureHealth.js";
import type { ArchitectureEdge, ArchitectureNode } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureGraph.js";

const file = (path: string, module: string): ArchitectureNode => ({ id: `file:${path}`, type: "file", label: path, module, layer: null, path, role: null, role_label: null });
const moduleNode = (name: string): ArchitectureNode => ({ id: `module:${name}`, type: "module", label: name, module: name, layer: null, path: name, role: null, role_label: null });
const imp = (from: string, to: string, crossModule = false): ArchitectureEdge => ({
  id: `${from}->${to}`,
  source: `file:${from}`,
  target: to.startsWith("module:") ? to : `file:${to}`,
  type: "import",
  label: "",
  crossModule,
});

describe("architectureHealth", () => {
  const nodes = [moduleNode("pages"), moduleNode("globals"), file("pages/a.js", "pages"), file("pages/b.js", "pages"), file("globals/g.js", "globals"), file("globals/h.js", "globals")];
  const edges: ArchitectureEdge[] = [
    imp("pages/a.js", "globals/g.js", true),
    imp("pages/a.js", "globals/g.js", true),
    imp("pages/b.js", "globals/g.js", true),
    imp("pages/a.js", "pages/b.js"),
    imp("pages/b.js", "pages/a.js"),
    imp("globals/h.js", "module:pages", true),
    { id: "c", source: "module:pages", target: "file:pages/a.js", type: "contains", label: "", crossModule: false },
    // Un edge que no es import no cuenta aunque una dos archivos de modulos distintos.
    { id: "x", source: "file:globals/h.js", target: "file:pages/b.js", type: "contains", label: "", crossModule: true },
  ];

  it("resume archivos, imports, acoplamiento entre modulos y ciclos", () => {
    const health = architectureHealth(nodes, edges);

    expect(health.summary).toEqual({ files: 4, imports: 4, crossModuleImports: 4, modulePairs: 2, cycles: 1, filesInCycles: 2, largestCycle: 2 });
    expect(health.cycles.map((cycle) => cycle.files)).toEqual([["pages/a.js", "pages/b.js"]]);
  });

  it("rankea los mas importados y los que mas importan (distintos, count > 0, desempate por path)", () => {
    const health = architectureHealth(nodes, edges);

    expect(health.mostImported).toEqual([
      { path: "globals/g.js", module: "globals", count: 2 },
      { path: "pages/a.js", module: "pages", count: 1 },
      { path: "pages/b.js", module: "pages", count: 1 },
    ]);
    expect(health.mostImporting).toEqual([
      { path: "pages/a.js", module: "pages", count: 2 },
      { path: "pages/b.js", module: "pages", count: 2 },
    ]);
  });

  it("como maximo 10 por ranking y sin ciclos el mayor es 0", () => {
    const many = Array.from({ length: 12 }, (_, index) => file(`f${String(index).padStart(2, "0")}.js`, "M"));
    const hub = file("hub.js", "M");
    const health = architectureHealth([...many, hub], many.map((node) => imp(node.path, "hub.js")));

    expect(health.mostImporting).toHaveLength(10);
    expect(health.mostImporting[0]).toEqual({ path: "f00.js", module: "M", count: 1 });
    expect(health.mostImported).toEqual([{ path: "hub.js", module: "M", count: 12 }]);
    expect(health.summary).toMatchObject({ cycles: 0, filesInCycles: 0, largestCycle: 0, crossModuleImports: 0, modulePairs: 0 });
  });
});
