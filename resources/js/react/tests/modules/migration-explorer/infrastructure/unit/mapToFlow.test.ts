import { describe, expect, it } from "vitest";

import type { BoundedContextMap } from "../../../../../modules/migration-explorer/domain/value-objects/BoundedContextMap";
import { mapToFlow } from "../../../../../modules/migration-explorer/infrastructure/react-flow/mapToFlow";

function map(): BoundedContextMap {
  return {
    generatedAt: "t",
    modules: [
      {
        key: "tours",
        name: "Tours",
        validated: false,
        layers: {
          domain: [{ path: "Tours/Domain/Tour.php" }],
          application: [{ path: "Tours/Application/Export.php" }, { path: "Tours/Application/Import.php" }],
          infrastructure: [],
          presentation: [],
        },
      },
      { key: "users", name: "Users", validated: true, layers: { domain: [], application: [], infrastructure: [], presentation: [] } },
    ],
  };
}

describe("mapToFlow overview", () => {
  it("crea un nodo por modulo (bcModule) con su conteo de archivos y posicion en grilla", () => {
    const { nodes, edges } = mapToFlow(map(), "overview", null);

    expect(edges).toEqual([]);
    expect(nodes.map((node) => node.id)).toEqual(["module:tours", "module:users"]);
    expect(nodes[0].type).toBe("bcModule");
    expect(nodes[0].draggable).toBe(true);
    expect((nodes[0].data as { fileCount: number }).fileCount).toBe(3);
    expect((nodes[1].data as { fileCount: number }).fileCount).toBe(0);
    // grilla: 2 modulos centrados -> x = -120 y +120, misma fila
    expect(nodes[0].position).toEqual({ x: -120, y: 0 });
    expect(nodes[1].position).toEqual({ x: 120, y: 0 });
  });
});

describe("mapToFlow module view", () => {
  it("crea 4 cabeceras de capa + un nodo por archivo en su capa, con edges capa->archivo", () => {
    const { nodes, edges } = mapToFlow(map(), "module", "tours");

    const layers = nodes.filter((node) => node.type === "bcLayer");
    const files = nodes.filter((node) => node.type === "bcFile");

    expect(layers.map((node) => (node.data as { layer: string }).layer)).toEqual(["domain", "application", "infrastructure", "presentation"]);
    expect(files.map((node) => (node.data as { file: { path: string } }).file.path)).toEqual([
      "Tours/Domain/Tour.php",
      "Tours/Application/Export.php",
      "Tours/Application/Import.php",
    ]);

    // capas en columnas: domain (idx 0) -> x = -480; application (idx 1) -> x = -160
    expect(layers[0].position).toEqual({ x: -480, y: 0 });
    expect(layers[1].position.x).toBe(-160);
    expect((layers[1].data as { count: number }).count).toBe(2);

    // archivos bajo su capa, apilados
    const domainFile = files.find((node) => (node.data as { file: { path: string } }).file.path === "Tours/Domain/Tour.php");
    expect(domainFile?.position).toEqual({ x: -480, y: 110 });
    expect(domainFile?.data).toMatchObject({ moduleKey: "tours", layer: "domain" });
    const secondApp = files.find((node) => (node.data as { file: { path: string } }).file.path === "Tours/Application/Import.php");
    expect(secondApp?.position).toEqual({ x: -160, y: 180 }); // segunda fila de application

    // edges capa -> archivo
    expect(edges).toHaveLength(3);
    expect(edges[0]).toMatchObject({ id: "e:layer:tours:domain:file:tours:domain:Tours/Domain/Tour.php", source: "layer:tours:domain", target: "file:tours:domain:Tours/Domain/Tour.php" });
  });

  it("un focus inexistente cae a overview", () => {
    expect(mapToFlow(map(), "module", "nope").nodes.every((node) => node.type === "bcModule")).toBe(true);
  });
});
