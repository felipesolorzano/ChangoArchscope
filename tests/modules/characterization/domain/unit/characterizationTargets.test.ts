import { describe, expect, it } from "vitest";

import { characterizationTargets } from "../../../../../app/modules/characterization/domain/services/characterizationTargets.js";
import { finding } from "../../support.js";

const ROOT = "/b/src";
const component = (file: string, name: string, complexity = 3, exportedAs: string | null = name) =>
  finding("untested-component", `${ROOT}/${file}`, { class: name, details: { name, cyclomaticComplexity: complexity, exportedAs } });
const endpoint = (rule: string, file: string, value: string | null) => finding(rule, `${ROOT}/${file}`, { details: { endpoint: value } });

describe("characterizationTargets (react)", () => {
  it("rankea por riesgo × log2(2 + importadores), con kind, componentes sin test y endpoints", () => {
    const findings = [
      component("pages/page.checkout.js", "default", 40, "default"),
      component("pages/page.checkout.js", "Cart"),
      component("pages/page.checkout.js", "checkout", 5, "default"),
      component("pages/page.checkout.js", "Inner", 2, null),
      component("pages/page.checkout.js", "Cart"),
      endpoint("http-in-component", "pages/page.checkout.js", "DoPayment"),
      endpoint("duplicate-endpoint", "pages/page.checkout.js", "GetPromotion"),
      endpoint("hardcoded-api-url", "pages/page.checkout.js", "https://api.x.com/Rates"),
      endpoint("jquery-usage", "pages/page.checkout.js", "NoEsEndpoint"),
      endpoint("http-in-component", "pages/page.checkout.js", null),
      component("components/hub.js", "Hub"),
      endpoint("http-in-component", "components/other.js", "Ignored"),
    ];
    const targets = characterizationTargets({
      stack: "react",
      sourceRoot: ROOT,
      findings,
      riskByFile: { [`${ROOT}/pages/page.checkout.js`]: 80, [`${ROOT}/components/hub.js`]: 10 },
      importersByFile: { [`${ROOT}/components/hub.js`]: 150 },
    });

    expect(targets).toEqual([
      {
        file: "pages/page.checkout.js",
        kind: "page",
        score: 80,
        risk: 80,
        importers: 0,
        untested: [
          { name: "PageCheckout", complexity: 40, exportedAs: "default" },
          { name: "Cart", complexity: 3, exportedAs: "Cart" },
          { name: "checkout", complexity: 5, exportedAs: "default" },
          { name: "Inner", complexity: 2, exportedAs: null },
        ],
        endpoints: ["DoPayment", "GetPromotion", "https://api.x.com/Rates"],
      },
      { file: "components/hub.js", kind: "component", score: 72, risk: 10, importers: 150, untested: [{ name: "Hub", complexity: 3, exportedAs: "Hub" }], endpoints: [] },
    ]);
  });

  it("hallazgo sin exportedAs (snapshot viejo): default si se llamaba default, si no su nombre", () => {
    const legacy = (name: string) => finding("untested-component", `${ROOT}/a.js`, { details: { name, cyclomaticComplexity: 1 } });
    const [target] = characterizationTargets({ stack: "react", sourceRoot: ROOT, findings: [legacy("default"), legacy("Cart")], riskByFile: {}, importersByFile: {} });

    expect(target.untested).toEqual([
      { name: "A", complexity: 1, exportedAs: "default" },
      { name: "Cart", complexity: 1, exportedAs: "Cart" },
    ]);
  });

  it("excluye copias manuales y archivos sin uso", () => {
    const findings = [component("a.js", "A"), finding("manual-copy-file", `${ROOT}/a.js`), component("b.js", "B"), finding("possibly-unused-file", `${ROOT}/b.js`), component("c.js", "C")];

    expect(characterizationTargets({ stack: "react", sourceRoot: ROOT, findings, riskByFile: {}, importersByFile: {} }).map((target) => target.file)).toEqual(["c.js"]);
  });

  it("kind page por carpetas pages/page/routes/views/screens; empate por archivo; como maximo 20", () => {
    const files = ["pages/x.js", "page/x.js", "routes/x.js", "views/x.js", "screens/x.js", "pagesx/x.js", "app/pages/y.js", "lib/screens"];
    const kinds = characterizationTargets({ stack: "react", sourceRoot: ROOT, findings: files.map((file) => component(file, "X")), riskByFile: {}, importersByFile: {} });
    expect(kinds.map((target) => [target.file, target.kind])).toEqual([
      ["app/pages/y.js", "page"],
      ["lib/screens", "component"],
      ["page/x.js", "page"],
      ["pages/x.js", "page"],
      ["pagesx/x.js", "component"],
      ["routes/x.js", "page"],
      ["screens/x.js", "page"],
      ["views/x.js", "page"],
    ]);

    const many = Array.from({ length: 25 }, (_, index) => component(`f${String(index).padStart(2, "0")}.js`, "F"));
    const risk = Object.fromEntries(many.map((item, index) => [item.file, index]));
    const top = characterizationTargets({ stack: "react", sourceRoot: ROOT, findings: many, riskByFile: risk, importersByFile: {} });
    expect(top).toHaveLength(20);
    expect(top[0].file).toBe("f24.js");
  });
});

describe("characterizationTargets (laravel)", () => {
  it("metodos complejos sin test por clase, sin repetir; kind php", () => {
    const method = (cls: string, name: string) => finding("untested-complex-method", "/mc/lib/Trafic.lib.inc", { class: cls, details: { name: cls, method: name } });
    const targets = characterizationTargets({
      stack: "laravel",
      sourceRoot: "/mc",
      findings: [method("MSTrafic", "Book"), method("MSTrafic", "Book"), method("MSTrafic", "Cancel"), method("Other", "Run"), component("x.js", "Ignored")],
      riskByFile: { "/mc/lib/Trafic.lib.inc": 7220 },
      importersByFile: { "/mc/lib/Trafic.lib.inc": 2 },
    });

    expect(targets).toEqual([
      {
        file: "lib/Trafic.lib.inc",
        kind: "php",
        score: 14440,
        risk: 7220,
        importers: 2,
        untested: [
          { name: "MSTrafic::Book", complexity: null },
          { name: "MSTrafic::Cancel", complexity: null },
          { name: "Other::Run", complexity: null },
        ],
        endpoints: [],
      },
    ]);
  });
});

describe("pascalCase", () => {
  it("separadores repetidos, al principio o al final", async () => {
    const { pascalCase } = await import("../../../../../app/modules/characterization/domain/services/pascalCase.js");

    expect(pascalCase("page..checkout - copia")).toBe("PageCheckoutCopia");
    expect(pascalCase("_x.")).toBe("X");
  });
});
