import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { CodemodController } from "../../../../../app/modules/codemods/presentation/http/CodemodController.js";
import { finding, legacy } from "../../support.js";

const snapshotFor = (root: string) =>
  ({ findings: [legacy("each", `${root}/a.php`, { count: 2 }), finding("jquery-usage", `${root}/a.js`, { details: { count: 1 } })], testedBy: {} }) as unknown as AuditSnapshot;

function deps() {
  return {
    snapshots: { getSnapshot: vi.fn(async (target: "laravel" | "react") => snapshotFor(target === "react" ? "/js" : "/php")) },
    rootOf: (target: "laravel" | "react") => (target === "react" ? "/js" : "/php"),
  };
}

async function respond(query: Record<string, unknown>, d = deps()) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn() as NextFunction;
  await new CodemodController(d).show({ query } as unknown as Request, response, next);
  return { body: json.mock.calls[0]?.[0], response, next, d };
}

describe("CodemodController", () => {
  it("react: snapshot y raiz del stack", async () => {
    const { body, response, d } = await respond({ target: "react" });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(d.snapshots.getSnapshot).toHaveBeenCalledWith("react");
    expect(body.candidates.map((candidate: { pattern: string; files: Array<{ file: string }> }) => [candidate.pattern, candidate.files[0].file])).toEqual([["jquery", "a.js"]]);
  });

  it("target desconocido cae a laravel", async () => {
    const { body, d } = await respond({ target: "vue" });

    expect(d.snapshots.getSnapshot).toHaveBeenCalledWith("laravel");
    expect(body.candidates.map((candidate: { pattern: string; files: Array<{ file: string }> }) => [candidate.pattern, candidate.files[0].file])).toEqual([["each", "a.php"]]);
  });

  it("un error va a next", async () => {
    const d = deps();
    d.snapshots.getSnapshot.mockRejectedValueOnce(new Error("boom"));

    const { next } = await respond({}, d);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
