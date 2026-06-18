import path from "node:path";
import { describe, expect, it } from "vitest";

import { nowIso, relativePosix, toPosixPath } from "../../../../../app/modules/architecture/domain/services/architecturePathUtils.js";

describe("architecturePathUtils", () => {
  it("normalizes posix paths", () => {
    expect(toPosixPath(["Module", "domain", "Thing.ts"].join(path.sep))).toBe("Module/domain/Thing.ts");
  });

  it("computes a relative posix path between two directories", () => {
    const from = path.join("project", "app", "modules");
    const to = path.join("project", "app", "modules", "Module", "domain", "Thing.ts");

    expect(relativePosix(from, to)).toBe("Module/domain/Thing.ts");
  });

  it("returns an ISO timestamp", () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
