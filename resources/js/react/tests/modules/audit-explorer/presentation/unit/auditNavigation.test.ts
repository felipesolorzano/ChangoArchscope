import { describe, expect, it } from "vitest";

import { breadcrumbFor, drillTargetFor } from "../../../../../modules/audit-explorer/presentation/utils/auditNavigation";

const node = (over: Partial<{ id: string; type: string; label: string }> = {}) => ({
  id: "app:admin",
  type: "app" as never,
  label: "admin",
  ...over,
});

describe("drillTargetFor", () => {
  it("overview + nodo app -> vista app con focus = label", () => {
    expect(drillTargetFor(node(), "overview")).toEqual({ view: "app", focus: "admin" });
  });

  it("overview + raiz no profundiza", () => {
    expect(drillTargetFor(node({ type: "root" as never, label: "mc" }), "overview")).toBeNull();
  });

  it("app + nodo file -> vista file con focus = id sin prefijo file:", () => {
    const fileNode = node({ id: "file:api/lib/OrderService.lib.inc", type: "file" as never, label: "OrderService.lib.inc" });

    expect(drillTargetFor(fileNode, "app")).toEqual({ view: "file", focus: "api/lib/OrderService.lib.inc" });
  });

  it("file view no profundiza mas", () => {
    expect(drillTargetFor(node({ type: "rule" as never }), "file")).toBeNull();
  });

  it("desde el heatmap, un nodo file abre su vista de reglas", () => {
    const fileNode = node({ id: "file:admin/Big.lib.inc", type: "file" as never, label: "Big.lib.inc" });

    expect(drillTargetFor(fileNode, "heatmap")).toEqual({ view: "file", focus: "admin/Big.lib.inc" });
  });
});

describe("breadcrumbFor", () => {
  it("overview = solo Monorepo (current)", () => {
    expect(breadcrumbFor("overview", null)).toEqual([
      { label: "Monorepo", view: "overview", focus: null, current: true },
    ]);
  });

  it("app = Monorepo > app(current)", () => {
    expect(breadcrumbFor("app", "admin")).toEqual([
      { label: "Monorepo", view: "overview", focus: null, current: false },
      { label: "admin", view: "app", focus: "admin", current: true },
    ]);
  });

  it("heatmap = solo Heatmap (current)", () => {
    expect(breadcrumbFor("heatmap", null)).toEqual([
      { label: "Heatmap", view: "heatmap", focus: null, current: true },
    ]);
  });

  it("file = Monorepo > app > archivo(current), derivando app del primer segmento", () => {
    expect(breadcrumbFor("file", "api/lib/OrderService.lib.inc")).toEqual([
      { label: "Monorepo", view: "overview", focus: null, current: false },
      { label: "api", view: "app", focus: "api", current: false },
      { label: "OrderService.lib.inc", view: "file", focus: "api/lib/OrderService.lib.inc", current: true },
    ]);
  });
});
