import { ReactFlowProvider } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BoundedContextMap, BoundedContextModule } from "../../../../../modules/migration-explorer/domain/value-objects/BoundedContextMap";
import type { MigrationExplorerDependencies } from "../../../../../modules/migration-explorer/infrastructure/factory/createMigrationExplorerDependencies";
import { BcFileCard } from "../../../../../modules/migration-explorer/presentation/components/BcFileCard";
import { BcLayerCard } from "../../../../../modules/migration-explorer/presentation/components/BcLayerCard";
import { BcModuleCard } from "../../../../../modules/migration-explorer/presentation/components/BcModuleCard";
import { MigrationCanvas } from "../../../../../modules/migration-explorer/presentation/components/MigrationCanvas";
import { applyMoveFile, toggleModuleValidated } from "../../../../../modules/migration-explorer/presentation/hooks/useMigrationController";
import MigrationExplorer, { viewHint } from "../../../../../modules/migration-explorer/presentation/pages/MigrationExplorer";

const html = (element: JSX.Element) => renderToStaticMarkup(element);
const inFlow = (element: JSX.Element) => html(<ReactFlowProvider>{element}</ReactFlowProvider>);
const node = (Component: (props: never) => JSX.Element | null, data: unknown) => inFlow(<Component {...({ id: "n", data } as never)} />);

const module = (over: Partial<BoundedContextModule> = {}): BoundedContextModule => ({
  key: "tours",
  name: "Tours",
  description: "Catalogo de tours",
  validated: false,
  layers: { domain: [{ path: "tours/domain/Tour.ts" }], application: [], infrastructure: [], presentation: [{ path: "tours/presentation/Page.tsx", note: "reemplaza page.tours" }] },
  ...over,
});
const map = (modules: BoundedContextModule[]): BoundedContextMap => ({ generatedAt: "t", modules });

describe("MigrationCanvas", () => {
  const base = { loading: false, error: null, empty: false, nodes: [], edges: [], onInit: () => {} };

  it("carga, error, vacio y lienzo", () => {
    expect(html(<MigrationCanvas {...base} loading />)).toContain("Cargando mapa de bounded contexts...");
    expect(html(<MigrationCanvas {...base} error="sin db" />)).toContain("sin db");
    expect(html(<MigrationCanvas {...base} empty />)).toContain("docs/bounded-context-map-schema.md");
    expect(html(<MigrationCanvas {...base} />)).toContain("react-flow");
  });
});

describe("nodos del mapa", () => {
  it("BcModuleCard: nombre, descripcion, archivos y boton de validar", () => {
    const markup = node(BcModuleCard, { module: module(), fileCount: 2 });

    expect(markup).toContain("Tours");
    expect(markup).toContain("Catalogo de tours");
    expect(markup).toContain("2 archivos");
    expect(markup).toContain("Validar");
    expect(markup).not.toContain("bc-module--ok");
  });

  it("BcModuleCard validado y sin descripcion", () => {
    const markup = node(BcModuleCard, { module: module({ validated: true, description: undefined }), fileCount: 0 });

    expect(markup).toContain("Validado");
    expect(markup).toContain("bc-module--ok");
    expect(markup).not.toContain("bc-module__desc");
  });

  it("BcLayerCard: capa legible y conteo", () => {
    const markup = node(BcLayerCard, { moduleKey: "tours", layer: "presentation", count: 7 });

    expect(markup).toContain("Presentation");
    expect(markup).toContain(">7<");
  });

  it("BcFileCard: nombre, nota y selector con la capa actual", () => {
    const markup = node(BcFileCard, { moduleKey: "tours", layer: "domain", file: { path: "tours/domain/Tour.ts", note: "entidad raiz" } });

    expect(markup).toContain(">Tour.ts<");
    expect(markup).toContain("entidad raiz");
    expect(markup.match(/<option/g)).toHaveLength(4);
    expect(markup).toMatch(/<option value="domain" selected="">/);
  });
});

describe("transformaciones puras del mapa", () => {
  it("applyMoveFile mueve el archivo de capa y deja los demas", () => {
    const base = module();
    const withTwo = { ...base, layers: { ...base.layers, domain: [{ path: "tours/domain/Tour.ts" }, { path: "tours/domain/TourId.ts" }] } };
    const moved = applyMoveFile(map([withTwo]), "tours", "domain", "tours/domain/Tour.ts", "application");

    expect(moved.modules[0].layers.domain).toEqual([{ path: "tours/domain/TourId.ts" }]);
    expect(moved.modules[0].layers.application).toEqual([{ path: "tours/domain/Tour.ts" }]);
  });

  it("applyMoveFile no cambia nada si el archivo o el modulo no existen", () => {
    const original = map([module(), module({ key: "other" })]);

    expect(applyMoveFile(original, "tours", "domain", "nope.ts", "application")).toEqual(original);
    expect(applyMoveFile(original, "ghost", "domain", "tours/domain/Tour.ts", "application")).toEqual(original);
  });

  it("toggleModuleValidated invierte solo el modulo indicado", () => {
    const toggled = toggleModuleValidated(map([module(), module({ key: "other" })]), "tours");

    expect(toggled.modules.map((item) => item.validated)).toEqual([true, false]);
  });
});

describe("MigrationExplorer", () => {
  it("miga de la vista general y estado de carga", () => {
    const dependencies: MigrationExplorerDependencies = {
      mapProvider: { getMap: () => new Promise(() => {}), saveMap: () => new Promise(() => {}) },
    };
    const markup = html(<MigrationExplorer dependencies={dependencies} />);

    expect(markup).toContain("Mapa de bounded contexts");
    expect(markup).toContain("Cargando mapa de bounded contexts...");
  });

  it("viewHint segun la vista", () => {
    expect(viewHint("overview")).toBe(" · click en un módulo para ver sus capas y archivos");
    expect(viewHint("module")).toBe(" · usa el selector de cada archivo para moverlo de capa (se guarda)");
  });
});
