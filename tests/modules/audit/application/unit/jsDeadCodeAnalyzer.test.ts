import { describe, expect, it } from "vitest";

import { jsDeadCodeAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsDeadCodeAnalyzer.js";
import { jsFile } from "../../support/jsStructures.js";

const imports = (...sources: string[]) => sources.map((source, index) => ({ source, names: [], line: index + 1 }));

describe("jsDeadCodeAnalyzer — possibly-unused-file", () => {
  it("marca los archivos que nadie importa; los importados y los index no", () => {
    const files = [
      jsFile("/src/index.js", { imports: imports("./routes/routes", "react") }),
      jsFile("/src/routes/routes.js", { imports: imports("../pages/page.home") }),
      jsFile("/src/pages/page.home.js"),
      jsFile("/src/pages/page.orphan.js"),
    ];

    expect(jsDeadCodeAnalyzer(files)).toEqual([
      {
        category: "dead_code",
        rule: "possibly-unused-file",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: "/src/pages/page.orphan.js",
        line: 1,
        message: 'Ningun archivo escaneado importa "page.orphan.js". Verificar antes de eliminar.',
        details: { name: "page.orphan.js" },
      },
    ]);
  });

  it("un require dinamico marca como usados todos los archivos que encajan con el patron", () => {
    const files = [
      jsFile("/src/index.js", { imports: imports("./configs/config") }),
      jsFile("/src/configs/config.js", { imports: imports("./config.${}") }),
      jsFile("/src/configs/config.avis.js"),
      jsFile("/src/configs/config.hertz.js"),
      jsFile("/src/configs/other.js"),
    ];

    expect(jsDeadCodeAnalyzer(files).map((finding) => finding.file)).toEqual(["/src/configs/other.js"]);
  });

  it("un archivo que solo se importa a si mismo cuenta como no usado", () => {
    const files = [jsFile("/src/index.js"), jsFile("/src/a.js", { imports: imports("./a") })];

    expect(jsDeadCodeAnalyzer(files).map((finding) => finding.file)).toEqual(["/src/a.js"]);
  });

  it("index y main con cualquier extension son entry points", () => {
    const files = [jsFile("/src/index.tsx"), jsFile("/src/app/index.jsx"), jsFile("/src/app/main.tsx")];

    expect(jsDeadCodeAnalyzer(files)).toEqual([]);
  });

  it("un archivo que solo contiene index en el nombre no es entry point", () => {
    const files = [jsFile("/src/index.js"), jsFile("/src/myindex.js"), jsFile("/src/index.helpers.js")];

    expect(jsDeadCodeAnalyzer(files).map((finding) => finding.file)).toEqual(["/src/myindex.js", "/src/index.helpers.js"]);
  });
});

describe("jsDeadCodeAnalyzer — manual-copy-file", () => {
  it.each([
    "page.checkout - copia.js",
    "page.checkout - copia (4).js",
    "page.cart - Copy.js",
    "component.cart.list copy.js",
    "component.cart.list copy 2.js",
    "component.cart.list copy 12.js",
    "page.checkout - copia (12).js",
    "component.cart.list_copia.js",
    "page.landing_copy.js",
    "page.privacy_old.js",
    "component.tour.availability.devel.js",
    "legacy.bak.jsx",
    "Thing_OLD.tsx",
  ])("%s es una copia manual", (name) => {
    const files = [jsFile("/src/index.js", { imports: imports(`./${name}`) }), jsFile(`/src/${name}`)];

    expect(jsDeadCodeAnalyzer(files)).toEqual([
      {
        category: "dead_code",
        rule: "manual-copy-file",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: `/src/${name}`,
        line: 1,
        message: `"${name}" parece una copia manual de otro archivo. Verificar antes de eliminar.`,
        details: { name },
      },
    ]);
  });

  it.each(["config.bookingwidget2.js", "page.checkout.js", "copyright.js", "olden.js", "page.copy.js", "develop.js", "page_oldies.js", "page.devel.helpers.js"])(
    "%s no es copia",
    (name) => {
      const files = [jsFile("/src/index.js", { imports: imports(`./${name}`) }), jsFile(`/src/${name}`)];

      expect(jsDeadCodeAnalyzer(files)).toEqual([]);
    },
  );

  it("una copia sin usar genera los dos findings", () => {
    const findings = jsDeadCodeAnalyzer([jsFile("/src/index.js"), jsFile("/src/a_old.js")]);

    expect(findings.map((finding) => finding.rule)).toEqual(["possibly-unused-file", "manual-copy-file"]);
  });
});
