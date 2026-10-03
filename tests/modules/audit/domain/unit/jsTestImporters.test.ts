import { describe, expect, it } from "vitest";

import { isJsTestFile, jsTestImporters } from "../../../../../app/modules/audit/domain/services/jsTestImporters.js";
import { jsFile } from "../../support/jsStructures.js";

const imports = (...sources: string[]) => sources.map((source) => ({ source, names: [], line: 1 }));

describe("jsTestImporters (XRay X5)", () => {
  it("por archivo, los tests que lo importan (ordenados); un test no se cubre a si mismo", () => {
    const files = [
      jsFile("/src/a.js"),
      jsFile("/src/b.js"),
      jsFile("/src/c.js", { imports: imports("./a") }),
      jsFile("/src/z.test.js", { imports: imports("./a", "./b", "./z.test", "react") }),
      jsFile("/src/__tests__/a.js", { imports: imports("../a") }),
      jsFile("/tests/a.spec.ts", { imports: imports("../src/a") }),
    ];

    expect(jsTestImporters(files)).toEqual({
      "/src/a.js": ["/src/__tests__/a.js", "/src/z.test.js", "/tests/a.spec.ts"],
      "/src/b.js": ["/src/z.test.js"],
    });
  });

  it("isJsTestFile: .test., .spec. y /__tests__/", () => {
    expect(["/a.test.js", "/a.spec.tsx", "/x/__tests__/a.js", "/a.js", "/tests/a.js", "/__tests__a.js"].map(isJsTestFile)).toEqual([true, true, true, false, false, false]);
  });
});
