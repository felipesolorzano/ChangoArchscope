import { describe, expect, it } from "vitest";

import { codemodSummary, codemodToolLabel, codemodWarning } from "../../../../../modules/plan-explorer/presentation/constants/codemodView";
import type { CodemodCandidate } from "../../../../../modules/plan-explorer/domain/value-objects/Codemod";

const candidate = (overrides: Partial<CodemodCandidate> = {}): CodemodCandidate => ({
  pattern: "unsafe-lifecycles",
  title: "Lifecycles",
  tool: "react-codemod",
  command: "npx react-codemod rename-unsafe-lifecycles \"a.js\"",
  note: "",
  files: [
    { file: "a.js", occurrences: 3, testedBy: ["a.test.js"] },
    { file: "b.js", occurrences: 2, testedBy: [] },
  ],
  occurrences: 5,
  protectedFiles: 1,
  ...overrides,
});

describe("codemodView (XRay X5)", () => {
  it("etiqueta de herramienta: automatico o manual", () => {
    expect(codemodToolLabel(candidate())).toBe("Automatico · react-codemod");
    expect(codemodToolLabel(candidate({ tool: null }))).toBe("Manual");
  });

  it("resumen con singular y plural", () => {
    expect(codemodSummary(candidate())).toBe("2 archivos · 5 ocurrencias · 1/2 con tests");
    expect(codemodSummary(candidate({ files: [{ file: "a.js", occurrences: 1, testedBy: [] }], occurrences: 1, protectedFiles: 0 }))).toBe("1 archivo · 1 ocurrencia · 0/1 con tests");
  });

  it("aviso solo si hay archivos sin tests", () => {
    expect(codemodWarning(candidate())).toBe("Caracterizar antes: 1 archivo sin tests");
    expect(codemodWarning(candidate({ protectedFiles: 0 }))).toBe("Caracterizar antes: 2 archivos sin tests");
    expect(codemodWarning(candidate({ protectedFiles: 2 }))).toBeNull();
  });
});
