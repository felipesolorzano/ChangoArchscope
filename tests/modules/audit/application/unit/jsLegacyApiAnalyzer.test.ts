import { describe, expect, it } from "vitest";

import { jsLegacyApiAnalyzer } from "../../../../../app/modules/audit/application/analyzers/jsLegacyApiAnalyzer.js";
import { jsClass, jsFile, jsMethod } from "../../support/jsStructures.js";

const importOf = (source: string, names: string[], line: number) => ({ source, names, line });

describe("jsLegacyApiAnalyzer (XRay X5)", () => {
  it("unsafe-lifecycle por metodo, con la clase y la linea del metodo", () => {
    const klass = jsClass({
      name: "checkout",
      methods: ["constructor", "componentWillMount", "UNSAFE_componentWillMount", "componentWillReceiveProps", "componentWillUpdate", "componentDidMount"].map((name, index) =>
        jsMethod({ name, startLine: 10 + index }),
      ),
    });

    expect(jsLegacyApiAnalyzer([jsFile("/src/page.js", { classes: [klass] })])).toEqual([
      {
        category: "legacy_api",
        rule: "unsafe-lifecycle",
        severity: "medium",
        source: "native",
        module: "",
        class: "checkout",
        file: "/src/page.js",
        line: 11,
        message: '"componentWillMount" esta deprecado (React 16.3+): migrar o renombrar a UNSAFE_componentWillMount.',
        details: { pattern: "unsafe-lifecycles", method: "componentWillMount" },
      },
      expect.objectContaining({ line: 13, details: { pattern: "unsafe-lifecycles", method: "componentWillReceiveProps" } }),
      expect.objectContaining({ line: 14, details: { pattern: "unsafe-lifecycles", method: "componentWillUpdate" } }),
    ]);
  });

  it("legacy-react-dom-api (render/hydrate/unmount → react-dom-render; findDOMNode) y string-ref", () => {
    const legacyReactApis = [
      { api: "render", line: 1 },
      { api: "hydrate", line: 2 },
      { api: "unmountComponentAtNode", line: 3 },
      { api: "findDOMNode", line: 4 },
      { api: "string-ref", line: 5 },
    ] as const;

    expect(jsLegacyApiAnalyzer([jsFile("/src/index.js", { legacyReactApis: [...legacyReactApis] })])).toEqual([
      expect.objectContaining({ rule: "legacy-react-dom-api", severity: "medium", class: null, line: 1, message: "ReactDOM.render no existe en React 19.", details: { pattern: "react-dom-render", api: "render" } }),
      expect.objectContaining({ rule: "legacy-react-dom-api", line: 2, message: "ReactDOM.hydrate no existe en React 19.", details: { pattern: "react-dom-render", api: "hydrate" } }),
      expect.objectContaining({ rule: "legacy-react-dom-api", line: 3, details: { pattern: "react-dom-render", api: "unmountComponentAtNode" } }),
      expect.objectContaining({ rule: "legacy-react-dom-api", line: 4, message: "findDOMNode no existe en React 19: usar una ref.", details: { pattern: "find-dom-node", api: "findDOMNode" } }),
      {
        category: "legacy_api",
        rule: "string-ref",
        severity: "medium",
        source: "native",
        module: "",
        class: null,
        file: "/src/index.js",
        line: 5,
        message: "Las string refs no existen en React 19: usar createRef/useRef.",
        details: { pattern: "string-refs" },
      },
    ]);
  });

  it("with-router: uno por archivo desde react-router(-dom), con la primera linea", () => {
    const imports = [
      importOf("react-router-dom", ["Link"], 1),
      importOf("./withRouter", ["withRouter"], 2),
      importOf("react-router", ["withRouter"], 3),
      importOf("react-router-dom", ["withRouter", "Link"], 4),
    ];

    expect(jsLegacyApiAnalyzer([jsFile("/src/a.js", { imports })])).toEqual([
      {
        category: "legacy_api",
        rule: "with-router",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 3,
        message: "withRouter no existe en React Router v6: usar hooks.",
        details: { pattern: "with-router" },
      },
    ]);
    expect(jsLegacyApiAnalyzer([jsFile("/src/b.js", { imports: [importOf("react-router-dom", ["withRouter"], 7)] })])[0].line).toBe(7);
  });

  it("deprecated-library: moment, request y react-ga (subrutas incluidas), uno por libreria y archivo", () => {
    const imports = [
      importOf("moment/locale/es", [], 2),
      importOf("moment", ["default"], 3),
      importOf("react-ga", ["default"], 4),
      importOf("request", [], 5),
      importOf("momentum", [], 6),
      importOf("@scope/moment", [], 7),
      importOf("./request", [], 8),
      importOf("react-ga4", [], 9),
    ];

    expect(jsLegacyApiAnalyzer([jsFile("/src/a.js", { imports })])).toEqual([
      {
        category: "legacy_api",
        rule: "deprecated-library",
        severity: "low",
        source: "native",
        module: "",
        class: null,
        file: "/src/a.js",
        line: 2,
        message: '"moment" esta deprecada: reemplazarla.',
        details: { pattern: "lib-moment", library: "moment" },
      },
      expect.objectContaining({ line: 4, details: { pattern: "lib-react-ga", library: "react-ga" } }),
      expect.objectContaining({ line: 5, details: { pattern: "lib-request", library: "request" } }),
    ]);
  });

  it("los archivos de test no generan findings; varios archivos en orden", () => {
    const legacy = { legacyReactApis: [{ api: "render" as const, line: 1 }] };
    const files = [jsFile("/src/a.test.js", legacy), jsFile("/src/__tests__/b.js", legacy), jsFile("/src/c.js", legacy), jsFile("/src/d.js", legacy)];

    expect(jsLegacyApiAnalyzer(files).map((finding) => finding.file)).toEqual(["/src/c.js", "/src/d.js"]);
  });
});
