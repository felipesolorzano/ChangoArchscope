import { describe, expect, it } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import type { ArchitectureEdge, ArchitectureNode } from "../../../../../app/modules/architecture/domain/value-objects/ArchitectureGraph.js";
import { buildCharacterizationPlan, importersByFile } from "../../../../../app/modules/characterization/application/use-cases/buildCharacterizationPlan.js";
import { finding } from "../../support.js";

const ROOT = "/b/src";
const file = (path: string): ArchitectureNode => ({ id: `file:${path}`, type: "file", label: path, module: "m", layer: null, path, role: null, role_label: null });
const edge = (from: string, to: string, type: "import" | "contains" = "import"): ArchitectureEdge => ({ id: `${from}>${to}`, source: from, target: to, type, label: "", crossModule: false });

const snapshot = {
  findings: [finding("untested-component", `${ROOT}/hub.js`, { class: "Hub", details: { name: "Hub", cyclomaticComplexity: 2 } })],
  riskBreakdown: { byFile: [{ key: `${ROOT}/hub.js`, value: 10, byCategory: {}, bySeverity: {}, findingsCount: 1 }], byClass: [], byModule: [], topRiskiestFiles: [] },
} as unknown as AuditSnapshot;

describe("buildCharacterizationPlan", () => {
  it("riesgo del snapshot, importadores distintos del grafo y esqueletos por objetivo", () => {
    const graph = {
      nodes: [file("hub.js"), file("a.js"), file("b.js"), { ...file("x"), id: "module:m", type: "module" as const }],
      edges: [edge("file:a.js", "file:hub.js"), edge("file:a.js", "file:hub.js"), edge("file:b.js", "file:hub.js"), edge("module:m", "file:hub.js", "contains"), edge("module:m", "file:hub.js")],
    };

    const plan = buildCharacterizationPlan({ snapshot, graph, sourceRoot: ROOT, stack: "react" });

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]).toMatchObject({ file: "hub.js", risk: 10, importers: 2, score: 20 });
    expect(plan.targets[0].skeletons.map((skeleton) => skeleton.kind)).toEqual(["rtl"]);
  });
});

describe("importersByFile", () => {
  it("cuenta fuentes distintas solo de edges import entre archivos", () => {
    const graph = {
      nodes: [file("hub.js"), file("a.js"), file("b.js"), { ...file("m"), id: "module:m", type: "module" as const }],
      edges: [
        edge("file:a.js", "file:hub.js"),
        edge("file:a.js", "file:hub.js"),
        edge("file:b.js", "file:hub.js", "contains"),
        edge("file:b.js", "module:m"),
        edge("module:m", "file:a.js"),
      ],
    };

    expect(importersByFile(graph, ROOT)).toEqual({ [`${ROOT}/hub.js`]: 1 });
  });
});

