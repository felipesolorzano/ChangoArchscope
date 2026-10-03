import { describe, expect, it } from "vitest";

import type { AuditSnapshot } from "../../../../../app/modules/audit/domain/value-objects/AuditSnapshot.js";
import { buildCodemodPlan } from "../../../../../app/modules/codemods/application/use-cases/buildCodemodPlan.js";
import { legacy } from "../../support.js";

describe("buildCodemodPlan", () => {
  it("candidatos desde los findings y testedBy del snapshot", () => {
    const snapshot = { findings: [legacy("with-router", "/b/src/a.js")], testedBy: { "/b/src/a.js": ["/b/src/a.test.js"] } } as unknown as AuditSnapshot;

    expect(buildCodemodPlan({ snapshot, sourceRoot: "/b/src", stack: "react" }).candidates).toEqual([
      expect.objectContaining({ pattern: "with-router", files: [{ file: "a.js", occurrences: 1, testedBy: ["a.test.js"] }], protectedFiles: 1 }),
    ]);
  });

  it("snapshot sin testedBy (cache viejo) → sin tests", () => {
    const snapshot = { findings: [legacy("with-router", "/b/src/a.js")] } as unknown as AuditSnapshot;

    expect(buildCodemodPlan({ snapshot, sourceRoot: "/b/src", stack: "react" }).candidates[0].files[0].testedBy).toEqual([]);
  });
});
