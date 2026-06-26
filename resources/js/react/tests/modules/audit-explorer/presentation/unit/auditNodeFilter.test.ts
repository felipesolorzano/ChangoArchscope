import { describe, expect, it } from "vitest";

import type { AuditGraphEdge, AuditGraphNode } from "../../../../../modules/audit-explorer/domain/value-objects/AuditGraph";
import { filterGraphByCategory } from "../../../../../modules/audit-explorer/presentation/utils/auditNodeFilter";

function node(
  id: string,
  byCategory: Record<string, number>,
  type: AuditGraphNode["type"] = "file",
): AuditGraphNode {
  return {
    id,
    type,
    label: id,
    position: { x: 0, y: 0 },
    size: 100,
    tone: "high",
    accent: "mixed",
    severityMix: { high: 1, medium: 0, low: 0 },
    metrics: { findings: 1, risk: 10 },
    byCategory,
    badges: [],
    drill: false,
  };
}

function contains(source: string, target: string): AuditGraphEdge {
  return { id: `${source}->${target}`, source, target, kind: "contains" };
}

describe("filterGraphByCategory", () => {
  it("con 'all' devuelve el grafo intacto", () => {
    const nodes = [node("a", { database: 3 }), node("b", { php_compatibility: 2 })];
    const edges = [contains("a", "b")];

    expect(filterGraphByCategory(nodes, edges, "all")).toEqual({ nodes, edges });
  });

  it("conserva archivos que TIENEN la categoria aunque NO sea su dominante", () => {
    // 'grande' esta dominado por database (2693) pero tiene 2 de compat -> debe conservarse.
    const grande = node("grande", { database: 2693, php_compatibility: 2 });
    const otro = node("otro", { security: 5 });

    const result = filterGraphByCategory([grande, otro], [], "php_compatibility");

    expect(result.nodes.map((n) => n.id)).toEqual(["grande"]);
  });

  it("descarta archivos sin ningun hallazgo de la categoria", () => {
    const result = filterGraphByCategory([node("a", { database: 10 })], [], "php_compatibility");

    expect(result.nodes).toEqual([]);
  });

  it("conserva el nodo ancla (padre de aristas contains) aunque no tenga la categoria", () => {
    const root = node("root", { database: 100 }, "root");
    const compat = node("compat", { php_compatibility: 4 });
    const edges = [contains("root", "compat"), contains("root", "db")];
    const db = node("db", { database: 9 });

    const result = filterGraphByCategory([root, compat, db], edges, "php_compatibility");

    expect(result.nodes.map((n) => n.id).sort()).toEqual(["compat", "root"]);
    expect(result.edges.map((e) => e.id)).toEqual(["root->compat"]);
  });
});
