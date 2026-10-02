import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { CharacterizationController } from "../../../../../app/modules/characterization/presentation/http/CharacterizationController.js";
import { finding } from "../../support.js";

const snapshotFor = (root: string) =>
  ({
    findings: [finding("untested-component", `${root}/a.js`, { class: "A", details: { name: "A", cyclomaticComplexity: 1 } })],
    riskBreakdown: { byFile: [], byClass: [], byModule: [], topRiskiestFiles: [] },
  }) as unknown as AuditSnapshot;

function deps() {
  return {
    snapshots: { getSnapshot: vi.fn(async (target: "laravel" | "react") => snapshotFor(target === "react" ? "/js" : "/php")) },
    graphOf: vi.fn((_target: "laravel" | "react") => ({ nodes: [], edges: [] })),
    rootOf: (target: "laravel" | "react") => (target === "react" ? "/js" : "/php"),
  };
}

async function respond(query: Record<string, unknown>, d = deps()) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn() as NextFunction;
  await new CharacterizationController(d).show({ query } as unknown as Request, response, next);
  return { body: json.mock.calls[0]?.[0], response, next, d };
}

describe("CharacterizationController", () => {
  it("react: snapshot, grafo y raiz del stack", async () => {
    const { body, response, d } = await respond({ target: "react" });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(d.snapshots.getSnapshot).toHaveBeenCalledWith("react");
    expect(d.graphOf).toHaveBeenCalledWith("react");
    expect(body.targets[0]).toMatchObject({ file: "a.js", kind: "component" });
  });

  it("target desconocido cae a laravel (kind php, sin componentes react como candidatos)", async () => {
    const { body, d } = await respond({ target: "vue" });

    expect(d.snapshots.getSnapshot).toHaveBeenCalledWith("laravel");
    expect(body.targets).toEqual([]);
  });

  it("un error va a next", async () => {
    const d = deps();
    d.snapshots.getSnapshot.mockRejectedValueOnce(new Error("boom"));

    const { next } = await respond({}, d);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
