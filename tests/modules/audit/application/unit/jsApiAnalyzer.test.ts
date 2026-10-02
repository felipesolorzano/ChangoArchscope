import { describe, expect, it } from "vitest";

import { jsApiAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsApiAnalyzer.js";
import { jsComponentClass, jsFile } from "../../support/jsStructures.js";

describe("jsApiAnalyzer — http-in-component", () => {
  it("cada llamada HTTP en un archivo con componentes es un finding", () => {
    const file = jsFile("/src/page.js", {
      classes: [jsComponentClass()],
      httpCalls: [{ client: "crud", endpoint: "GetTours", line: 12 }],
    });

    expect(jsApiAnalyzer([file])).toEqual([
      {
        category: "api_access",
        rule: "http-in-component",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/page.js",
        line: 12,
        message: "Llamada HTTP (crud) dentro de un archivo de componentes: la UI conoce la API directamente.",
        details: { client: "crud", endpoint: "GetTours" },
      },
    ]);
  });

  it("un archivo sin componentes (capa de datos) no dispara http-in-component", () => {
    const file = jsFile("/src/api.js", { httpCalls: [{ client: "fetch", endpoint: "/a", line: 1 }] });

    expect(jsApiAnalyzer([file])).toEqual([]);
  });
});

describe("jsApiAnalyzer — hardcoded-api-url", () => {
  it.each(["http://api.test/x", "https://api-sandbox.test/GetText"])("%s es una URL hardcodeada", (endpoint) => {
    const file = jsFile("/src/api.js", { httpCalls: [{ client: "request", endpoint, line: 3 }] });

    expect(jsApiAnalyzer([file])).toEqual([
      {
        category: "api_access",
        rule: "hardcoded-api-url",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/api.js",
        line: 3,
        message: `URL de API hardcodeada (${endpoint}): deberia salir de configuracion por entorno.`,
        details: { client: "request", endpoint },
      },
    ]);
  });

  it("rutas relativas, templates y null no son URL hardcodeada", () => {
    const file = jsFile("/src/api.js", {
      httpCalls: [
        { client: "fetch", endpoint: "/api/x", line: 1 },
        { client: "fetch", endpoint: "${}/https://x", line: 2 },
        { client: "fetch", endpoint: null, line: 3 },
      ],
    });

    expect(jsApiAnalyzer([file])).toEqual([]);
  });
});

describe("jsApiAnalyzer — duplicate-endpoint", () => {
  it("el mismo endpoint en 2+ archivos: un finding por ocurrencia", () => {
    const files = [
      jsFile("/src/a.js", { httpCalls: [{ client: "crud", endpoint: "Pay", line: 4 }, { client: "crud", endpoint: "Pay", line: 9 }] }),
      jsFile("/src/b.js", { httpCalls: [{ client: "crud", endpoint: "Pay", line: 2 }] }),
    ];

    const findings = jsApiAnalyzer(files);

    expect(findings.map((finding) => [finding.file, finding.line])).toEqual([
      ["/src/a.js", 4],
      ["/src/a.js", 9],
      ["/src/b.js", 2],
    ]);
    expect(findings[0]).toEqual({
      category: "api_access",
      rule: "duplicate-endpoint",
      severity: "low",
      source: "native",
      module: "",
      class: null,
      file: "/src/a.js",
      line: 4,
      message: 'El endpoint "Pay" se llama desde 2 archivos: la integracion esta duplicada.',
      details: { client: "crud", endpoint: "Pay", files: 2 },
    });
  });

  it("repetido solo dentro de un archivo, o null, no es duplicado", () => {
    const files = [
      jsFile("/src/a.js", { httpCalls: [{ client: "crud", endpoint: "Pay", line: 4 }, { client: "crud", endpoint: "Pay", line: 9 }] }),
      jsFile("/src/b.js", { httpCalls: [{ client: "fetch", endpoint: null, line: 1 }] }),
      jsFile("/src/c.js", { httpCalls: [{ client: "fetch", endpoint: null, line: 1 }] }),
    ];

    expect(jsApiAnalyzer(files)).toEqual([]);
  });

  it("una llamada puede disparar varias reglas, en orden de regla", () => {
    const files = [
      jsFile("/src/a.js", { classes: [jsComponentClass()], httpCalls: [{ client: "fetch", endpoint: "https://x/y", line: 1 }] }),
      jsFile("/src/b.js", { httpCalls: [{ client: "fetch", endpoint: "https://x/y", line: 1 }] }),
    ];

    expect(jsApiAnalyzer(files).map((finding) => [finding.file, finding.rule])).toEqual([
      ["/src/a.js", "http-in-component"],
      ["/src/a.js", "hardcoded-api-url"],
      ["/src/a.js", "duplicate-endpoint"],
      ["/src/b.js", "hardcoded-api-url"],
      ["/src/b.js", "duplicate-endpoint"],
    ]);
  });
});
