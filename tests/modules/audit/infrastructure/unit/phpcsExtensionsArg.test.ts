import { describe, expect, it } from "vitest";

import { phpcsExtensionsArg } from "../../../../../app/modules/audit/infrastructure/compat/phpcsExtensionsArg.js";

describe("phpcsExtensionsArg", () => {
  it("quita el punto inicial de cada extension", () => {
    expect(phpcsExtensionsArg([".php"])).toBe("php");
  });

  it("reduce una extension compuesta a su ultimo segmento (phpcs solo mira la ultima)", () => {
    expect(phpcsExtensionsArg([".lib.inc"])).toBe("inc");
  });

  it("convierte la config tipica [.php, .inc, .lib.inc] deduplicando", () => {
    expect(phpcsExtensionsArg([".php", ".inc", ".lib.inc"])).toBe("php,inc");
  });

  it("preserva el orden y dedupe estable", () => {
    expect(phpcsExtensionsArg([".inc", ".php", ".inc"])).toBe("inc,php");
  });

  it("acepta extensiones sin punto inicial", () => {
    expect(phpcsExtensionsArg(["php", "module.inc"])).toBe("php,inc");
  });

  it("cae a 'php' cuando la lista esta vacia o solo trae basura", () => {
    expect(phpcsExtensionsArg([])).toBe("php");
    expect(phpcsExtensionsArg(["."])).toBe("php");
    expect(phpcsExtensionsArg([""])).toBe("php");
  });
});
