import { describe, expect, it } from "vitest";

import { findImportCycles } from "../../../../../app/modules/architecture/domain/services/importCycles.js";
import type { ArchitectureEdge, ArchitectureNode } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureGraph.js";

const file = (path: string, module = "M"): ArchitectureNode => ({ id: `file:${path}`, type: "file", label: path, module, layer: null, path, role: null, role_label: null });
const moduleNode = (name: string): ArchitectureNode => ({ id: `module:${name}`, type: "module", label: name, module: name, layer: null, path: name, role: null, role_label: null });
const edge = (from: string, to: string, line?: number, type: "import" | "contains" = "import"): ArchitectureEdge => ({
  id: `${from}->${to}`,
  source: `file:${from}`,
  target: to.startsWith("module:") ? to : `file:${to}`,
  type,
  label: "",
  line,
  crossModule: false,
});

describe("findImportCycles", () => {
  it("ciclo de dos archivos del mismo modulo, con la linea del primer import", () => {
    const cycles = findImportCycles([file("a.js"), file("b.js"), file("c.js")], [edge("a.js", "b.js", 3), edge("b.js", "a.js", 7), edge("b.js", "c.js")]);

    expect(cycles).toEqual([{ files: ["a.js", "b.js"], path: ["a.js", "b.js", "a.js"], modules: ["M"], crossModule: false, line: 3 }]);
  });

  it("ciclo de tres archivos entre modulos; sin linea en el edge usa 1", () => {
    const nodes = [file("x/c.js", "X"), file("y/a.js", "Y"), file("y/b.js", "Y")];
    const cycles = findImportCycles(nodes, [edge("y/a.js", "y/b.js"), edge("y/b.js", "x/c.js"), edge("x/c.js", "y/a.js")]);

    expect(cycles).toEqual([{ files: ["x/c.js", "y/a.js", "y/b.js"], path: ["x/c.js", "y/a.js", "y/b.js", "x/c.js"], modules: ["X", "Y"], crossModule: true, line: 1 }]);
  });

  it("el recorrido es el mas corto dentro del componente y, a igual largo, va primero por orden de path", () => {
    // a → d → a (largo 2) y a → b → c → a (largo 3): gana el de 2.
    const nodes = ["a", "b", "c", "d"].map((name) => file(name));
    const short = findImportCycles(nodes, [edge("a", "b"), edge("b", "c"), edge("c", "a"), edge("a", "d"), edge("d", "a")]);
    expect(short[0].path).toEqual(["a", "d", "a"]);

    const tie = findImportCycles(nodes, [edge("a", "c"), edge("c", "a"), edge("a", "b"), edge("b", "a")]);
    expect(tie[0].path).toEqual(["a", "b", "a"]);
  });

  it("autoimport cuenta como ciclo; imports a modulos, contains y repetidos no", () => {
    const nodes = [file("a.js"), file("b.js"), moduleNode("Other")];
    const cycles = findImportCycles(nodes, [edge("a.js", "a.js", 4), edge("a.js", "b.js"), edge("a.js", "b.js"), edge("b.js", "module:Other"), edge("b.js", "a.js", undefined, "contains")]);

    expect(cycles).toEqual([{ files: ["a.js"], path: ["a.js", "a.js"], modules: ["M"], crossModule: false, line: 4 }]);
  });

  it("varios ciclos: los mas grandes primero, despues por el primer archivo", () => {
    const nodes = ["a", "b", "p", "q", "r", "z"].map((name) => file(name));
    const cycles = findImportCycles(nodes, [edge("z", "z"), edge("b", "a"), edge("a", "b"), edge("p", "q"), edge("q", "r"), edge("r", "p")]);

    expect(cycles.map((cycle) => cycle.files)).toEqual([["p", "q", "r"], ["a", "b"], ["z"]]);
  });

  it("un grafo sin ciclos no devuelve nada", () => {
    expect(findImportCycles([file("a"), file("b")], [edge("a", "b")])).toEqual([]);
  });

  it("un grafo lineal de 5000 archivos con un ciclo al final no desborda la pila", () => {
    const names = Array.from({ length: 5000 }, (_, index) => `f${String(index).padStart(5, "0")}`);
    const edges = names.slice(1).map((name, index) => edge(names[index], name));
    edges.push(edge(names[4999], names[0]));

    const cycles = findImportCycles(names.map((name) => file(name)), edges);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].files).toHaveLength(5000);
    expect(cycles[0].path).toHaveLength(5001);
  });

  it("dos ciclos conectados se separan aunque se visite primero el de abajo", () => {
    const nodes = ["c", "d", "a", "b"].map((name) => file(name));
    const cycles = findImportCycles(nodes, [edge("c", "d"), edge("d", "c"), edge("a", "b"), edge("b", "a"), edge("b", "c")]);

    expect(cycles.map((cycle) => cycle.files)).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("un autoimport alcanzado antes de ser raiz cuenta una sola vez", () => {
    expect(findImportCycles([file("a"), file("z")], [edge("a", "z"), edge("z", "z")]).map((cycle) => cycle.files)).toEqual([["z"]]);
  });

  it("un import repetido conserva la linea del primero", () => {
    expect(findImportCycles([file("a"), file("b")], [edge("a", "b", 3), edge("a", "b", 9), edge("b", "a")])[0].line).toBe(3);
  });

  it("un archivo alcanzado por dos caminos conserva el primero", () => {
    const nodes = ["a", "b", "c", "d"].map((name) => file(name));

    expect(findImportCycles(nodes, [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d"), edge("d", "a")])[0].path).toEqual(["a", "b", "d", "a"]);
  });

  it("un edge import que sale de un modulo no forma ciclo", () => {
    const fromModule: ArchitectureEdge = { id: "m", source: "module:Other", target: "file:a.js", type: "import", label: "", crossModule: false };

    expect(findImportCycles([file("a.js"), moduleNode("Other")], [edge("a.js", "module:Other"), fromModule])).toEqual([]);
  });
});
