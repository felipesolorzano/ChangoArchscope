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

  it("unused-export: exports que ningun otro archivo usa, en archivos importados que no son entry point", () => {
    const named = (source: string, ...names: string[]) => ({ source, names, line: 1 });
    const exports = (...names: string[]) => names.map((name, index) => ({ name, line: index + 10 }));
    const files = [
      jsFile("/src/index.js", { imports: [named("./a", "default", "used"), named("./b", "*"), named("./c"), named("./d", "x")], exports: exports("boot") }),
      jsFile("/src/a.js", { exports: exports("default", "used", "orphan"), imports: [named("./a", "orphan")] }),
      jsFile("/src/b.js", { exports: exports("anything") }),
      jsFile("/src/c.js", { exports: exports("viaRequire") }),
      jsFile("/src/d.js", { exports: exports("x", "y") }),
      jsFile("/src/lonely.js", { exports: exports("nobody") }),
    ];

    const findings = jsDeadCodeAnalyzer(files).filter((finding) => finding.rule === "unused-export");

    expect(findings).toEqual([
      {
        category: "dead_code",
        rule: "unused-export",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 12,
        message: '"orphan" se exporta pero ningun archivo lo importa. Verificar antes de eliminar.',
        details: { name: "a.js", export: "orphan" },
      },
      expect.objectContaining({ file: "/src/d.js", line: 11, details: { name: "d.js", export: "y" } }),
    ]);
  });

  it("unused-export: un test que importa el export lo cuenta como usado, pero no salva un archivo sin uso", () => {
    const named = (source: string, ...names: string[]) => ({ source, names, line: 1 });
    const files = [
      jsFile("/src/index.js", { imports: [named("./a", "default")] }),
      jsFile("/src/a.js", { exports: [{ name: "default", line: 1 }, { name: "forTests", line: 2 }] }),
      jsFile("/src/orphan.js", { exports: [{ name: "x", line: 1 }] }),
    ];
    const tests = [jsFile("/tests/a.test.js", { imports: [named("../src/a", "forTests"), named("../src/orphan", "x")] })];

    expect(jsDeadCodeAnalyzer(files, tests).map((finding) => `${finding.rule}:${finding.file}`)).toEqual(["possibly-unused-file:/src/orphan.js"]);
    expect(jsDeadCodeAnalyzer(files).map((finding) => `${finding.rule}:${finding.file}`)).toEqual(["unused-export:/src/a.js", "possibly-unused-file:/src/orphan.js"]);
  });
});
