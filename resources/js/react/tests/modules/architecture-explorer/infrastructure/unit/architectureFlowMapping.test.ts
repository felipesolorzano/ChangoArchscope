import { MarkerType } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { ArchitectureGraphEdge, ArchitectureGraphNode } from "../../../../../modules/architecture-explorer/domain/value-objects/ArchitectureGraph";
import { focusPositionsFor, groupNodes, positionFor } from "../../../../../modules/architecture-explorer/infrastructure/react-flow/architectureFlowLayout";
import {
  toArchitectureFlowEdges,
  toArchitectureFlowNodes,
} from "../../../../../modules/architecture-explorer/infrastructure/react-flow/architectureFlowMapping";
import { selectedNodeFor } from "../../../../../modules/architecture-explorer/presentation/utils/selectedNodeFor";

const node = (id: string, over: Partial<ArchitectureGraphNode> = {}): ArchitectureGraphNode => ({
  id,
  type: "file",
  label: id,
  module: "Users",
  layer: "Domain",
  path: `Users/${id}.ts`,
  ...over,
});
const edge = (id: string, source: string, target: string, crossModule = false): ArchitectureGraphEdge =>
  ({ id, source, target, type: "import", crossModule }) as ArchitectureGraphEdge;

describe("toArchitectureFlowEdges", () => {
  it("estilo y label segun crossModule, con flecha cerrada", () => {
    const [local, cross] = toArchitectureFlowEdges([edge("e1", "a", "b"), edge("e2", "a", "c", true)]);

    expect(local).toMatchObject({
      id: "e1",
      source: "a",
      target: "b",
      label: "import",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#64748b", strokeWidth: 1.2 },
      labelStyle: { fill: "#f8fafc", fontSize: 12, fontWeight: 800 },
      labelBgStyle: { fill: "rgba(15, 23, 42, 0.94)", fillOpacity: 1 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 4,
    });
    expect(cross).toMatchObject({
      label: "module import",
      animated: true,
      style: { stroke: "#f97316", strokeWidth: 2.4 },
      labelStyle: { fill: "#ffedd5" },
      labelBgStyle: { fill: "rgba(124, 45, 18, 0.94)" },
    });
  });

  it("ids repetidos reciben sufijo por ocurrencia", () => {
    expect(toArchitectureFlowEdges([edge("e", "a", "b"), edge("e", "a", "c"), edge("e", "a", "d")]).map((item) => item.id)).toEqual([
      "e",
      "e:1",
      "e:2",
    ]);
  });
});

describe("toArchitectureFlowNodes", () => {
  const nodes = [node("a"), node("b"), node("c")];
  const edges = [edge("e1", "a", "b")];

  it("sin foco: posicion guardada o de grilla, arrastrable, sin seleccion", () => {
    const flow = toArchitectureFlowNodes(nodes, edges, null, { b: { x: 9, y: 9 } });

    expect(flow.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(flow[0]).toEqual({ id: "a", type: "architectureNode", position: { x: 72, y: 140 }, data: nodes[0], selected: false, draggable: true });
    expect(flow[1].position).toEqual({ x: 9, y: 9 });
    // b uso su posicion guardada y no ocupa lugar en la grilla: c queda segundo (y = 140 + 92)
    expect(flow[2].position).toEqual({ x: 72, y: 232 });
  });

  it("con foco: la posicion de foco gana sobre la guardada y solo el enfocado esta seleccionado", () => {
    const flow = toArchitectureFlowNodes(nodes, edges, "a", { a: { x: 9, y: 9 }, c: { x: 1, y: 1 } });
    const focus = focusPositionsFor(nodes, edges, "a");

    expect(flow[0]).toMatchObject({ position: focus.get("a"), selected: true });
    expect(flow[1]).toMatchObject({ position: focus.get("b"), selected: false });
    expect(flow[2].position).toEqual({ x: 1, y: 1 });
  });
});

describe("groupNodes / positionFor (grilla, caracterizacion)", () => {
  it("columna por modulo alfabetico, desplazada por capa, y archivos apilados por grupo", () => {
    const grid = [
      node("mod", { type: "module", module: "Users", layer: null }),
      node("d", { module: "Users", layer: "Domain" }),
      node("i", { module: "Users", layer: "Infrastructure" }),
      node("p", { module: "Users", layer: "Presentation" }),
      node("p2", { module: "Users", layer: "Presentation" }),
      node("loose", { module: "Users", layer: null }),
      node("ad", { module: "Admin", layer: "Application" }),
    ];
    const grouped = groupNodes(grid);

    expect(grid.map((item) => [item.id, positionFor(item, grouped)])).toEqual([
      ["mod", { x: 420, y: 0 }],
      ["d", { x: 492, y: 140 }],
      ["i", { x: 636, y: 140 }],
      ["p", { x: 708, y: 140 }],
      ["p2", { x: 708, y: 232 }],
      ["loose", { x: 420, y: 232 }],
      ["ad", { x: 144, y: 140 }],
    ]);
  });
});

describe("focusPositionsFor (caracterizacion)", () => {
  it("entrantes a la izquierda, salientes a la derecha, compartidos debajo del foco", () => {
    const nodes = [node("f"), node("in1"), node("in2", { layer: "Application" }), node("out"), node("both"), node("mod", { type: "module", layer: null }), node("x"), node("y")];
    const edges = [
      edge("1", "in2", "f"),
      edge("2", "in1", "f"),
      edge("3", "mod", "f"),
      edge("4", "f", "out"),
      edge("5", "f", "both"),
      edge("6", "both", "f"),
      edge("7", "f", "f"),
      edge("8", "f", "ghost"),
      edge("9", "x", "y"),
    ];

    const positions = focusPositionsFor(nodes, edges, "f");

    // entrantes ordenados: modulo primero, luego por capa (Domain < Application). "both" tambien es
    // entrante: ocupa su fila (y=192) aunque termine debajo del foco, dejando ese hueco en la columna.
    expect(positions.get("mod")).toEqual({ x: 80, y: 80 });
    expect(positions.get("in1")).toEqual({ x: 80, y: 304 });
    expect(positions.get("in2")).toEqual({ x: 80, y: 416 });
    expect(positions.get("out")).toEqual({ x: 840, y: 80 });
    // foco centrado segun la columna mas larga (4 filas): 80 + 2 * 112
    expect(positions.get("f")).toEqual({ x: 460, y: 304 });
    expect(positions.get("both")).toEqual({ x: 460, y: 434 });
    expect(positions.has("ghost")).toBe(false);
    // un edge que no toca el foco no aporta vecinos
    expect(positions.has("x")).toBe(false);
    expect(positions.has("y")).toBe(false);
  });

  it("los vecinos se ordenan por capa hasta Presentation", () => {
    const nodes = [node("f"), node("p", { layer: "Presentation" }), node("i", { layer: "Infrastructure" })];
    const positions = focusPositionsFor(nodes, [edge("1", "p", "f"), edge("2", "i", "f")], "f");

    expect(positions.get("i")).toEqual({ x: 80, y: 80 });
    expect(positions.get("p")).toEqual({ x: 80, y: 192 });
  });

  it("el foco nunca queda mas arriba de y=240 y los compartidos van 130px debajo", () => {
    const positions = focusPositionsFor([node("f"), node("both")], [edge("1", "f", "both"), edge("2", "both", "f")], "f");

    expect(positions.get("f")).toEqual({ x: 460, y: 240 });
  });

  it("un foco inexistente no recibe posicion", () => {
    expect(focusPositionsFor([node("a")], [], "zzz").size).toBe(0);
  });
});

describe("selectedNodeFor", () => {
  const nodes = [node("UserService", { path: "Users/app/UserService.ts" }), node("Order", { path: "Orders/Order.ts" })];

  it("el nodo enfocado tiene prioridad", () => {
    expect(selectedNodeFor(nodes, nodes[1], "user")).toBe(nodes[1]);
  });

  it("si no, el primero cuyo path contiene la busqueda (trim, sin mayusculas)", () => {
    expect(selectedNodeFor(nodes, null, "  ORDERS/ ")).toBe(nodes[1]);
  });

  it("sin busqueda o sin coincidencia es null", () => {
    expect(selectedNodeFor(nodes, null, "   ")).toBeNull();
    expect(selectedNodeFor(nodes, null, "nada")).toBeNull();
  });
});
