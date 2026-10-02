import { describe, expect, it } from "vitest";

import { jsCouplingAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsCouplingAnalyzer.js";
import { jsClass, jsFile } from "../../support/jsStructures.js";

describe("jsCouplingAnalyzer — accesos globales (agregados por archivo)", () => {
  it("un finding por archivo y tipo, en la primera ocurrencia, con el conteo", () => {
    const file = jsFile("/src/a.js", {
      globalAccesses: [
        { kind: "window", line: 2 },
        { kind: "jquery", line: 5 },
        { kind: "jquery", line: 9 },
        { kind: "dom", line: 12 },
        { kind: "jquery", line: 3 },
      ],
    });

    const findings = jsCouplingAnalyzer([file]);

    expect(findings).toEqual([
      {
        category: "coupling_low_level",
        rule: "jquery-usage",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 3,
        message: "Usa jQuery 3 veces: manipula el DOM por fuera de React.",
        details: { count: 3 },
      },
      {
        category: "coupling_low_level",
        rule: "direct-dom-access",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 12,
        message: "Accede a document 1 veces: acceso directo al DOM desde el componente.",
        details: { count: 1 },
      },
      {
        category: "coupling_low_level",
        rule: "global-window-access",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 2,
        message: "Accede a window 1 veces: depende de estado global del navegador.",
        details: { count: 1 },
      },
    ]);
  });

  it("sin accesos no hay findings", () => {
    expect(jsCouplingAnalyzer([jsFile("/src/a.js")])).toEqual([]);
  });
});

describe("jsCouplingAnalyzer — herencia de una base propia", () => {
  it("base-class-inheritance para una clase que extiende algo que no es de React", () => {
    const file = jsFile("/src/a.js", { classes: [jsClass({ name: "Tours", startLine: 16, extendsName: "Global" })] });

    expect(jsCouplingAnalyzer([file])).toEqual([
      {
        category: "coupling_low_level",
        rule: "base-class-inheritance",
        severity: "medium",
        source: "native",
        module: "",
        class: "Tours",
        file: "/src/a.js",
        line: 16,
        message: 'La clase "Tours" hereda de "Global": comparte estado y comportamiento por herencia en vez de composicion.',
        details: { base: "Global" },
      },
    ]);
  });

  it.each(["Component", "PureComponent", "React.Component", "React.PureComponent"])("extender %s no es finding", (base) => {
    expect(jsCouplingAnalyzer([jsFile("/src/a.js", { classes: [jsClass({ extendsName: base })] })])).toEqual([]);
  });

  it("una clase sin extends no es finding", () => {
    expect(jsCouplingAnalyzer([jsFile("/src/a.js", { classes: [jsClass({ extendsName: null })] })])).toEqual([]);
  });
});
