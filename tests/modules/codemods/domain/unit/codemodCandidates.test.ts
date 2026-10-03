import { describe, expect, it } from "vitest";

import { codemodCandidates } from "../../../../../app/modules/codemods/domain/services/codemodCandidates.js";
import { finding, legacy } from "../../support.js";

const ROOT = "/b/src";

describe("codemodCandidates (react)", () => {
  it("agrupa por patron con archivos, ocurrencias, tests y comando; automaticos primero", () => {
    const findings = [
      legacy("unsafe-lifecycles", `${ROOT}/pages/page checkout.js`),
      legacy("unsafe-lifecycles", `${ROOT}/pages/page checkout.js`),
      legacy("unsafe-lifecycles", `${ROOT}/a.js`),
      legacy("unsafe-lifecycles", `${ROOT}/b.js`),
      legacy("unsafe-lifecycles", `${ROOT}/b.js`),
      finding("jquery-usage", `${ROOT}/a.js`, { details: { count: 4 } }),
      finding("jquery-usage", `${ROOT}/c.js`, { details: { count: 9 } }),
      finding("jquery-usage", `${ROOT}/d.js`, { details: { count: 1 } }),
      legacy("lib-moment", `${ROOT}/a.js`),
    ];
    const testedBy = { [`${ROOT}/a.js`]: [`${ROOT}/a.test.js`, "/b/tests/a.spec.js"] };

    expect(codemodCandidates({ stack: "react", sourceRoot: ROOT, findings, testedBy })).toEqual([
      {
        pattern: "unsafe-lifecycles",
        title: "Lifecycles deprecados (componentWillMount/ReceiveProps/Update)",
        tool: "react-codemod",
        command: 'npx react-codemod rename-unsafe-lifecycles "b.js" "pages/page checkout.js" "a.js"',
        note: "Solo renombra a UNSAFE_*: pasarlos a componentDidMount / getDerivedStateFromProps / componentDidUpdate sigue siendo manual.",
        timing: "before-upgrade",
        files: [
          { file: "b.js", occurrences: 2, testedBy: [] },
          { file: "pages/page checkout.js", occurrences: 2, testedBy: [] },
          { file: "a.js", occurrences: 1, testedBy: ["a.test.js", "../tests/a.spec.js"] },
        ],
        occurrences: 5,
        protectedFiles: 1,
      },
      {
        pattern: "jquery",
        title: "jQuery → DOM nativo / estado de React",
        tool: null,
        command: null,
        note: "Reemplazar selectores y efectos por refs/estado; $.ajax por fetch.",
        timing: "before-upgrade",
        files: [
          { file: "c.js", occurrences: 9, testedBy: [] },
          { file: "a.js", occurrences: 4, testedBy: ["a.test.js", "../tests/a.spec.js"] },
          { file: "d.js", occurrences: 1, testedBy: [] },
        ],
        occurrences: 14,
        protectedFiles: 1,
      },
      expect.objectContaining({ pattern: "lib-moment", occurrences: 1, protectedFiles: 1 }),
    ]);
  });

  it("excluye copias manuales y archivos sin uso; patrones sin archivos no aparecen", () => {
    const findings = [
      legacy("with-router", `${ROOT}/a.js`),
      legacy("with-router", `${ROOT}/a - copia.js`),
      finding("manual-copy-file", `${ROOT}/a - copia.js`),
      legacy("find-dom-node", `${ROOT}/dead.js`),
      finding("possibly-unused-file", `${ROOT}/dead.js`),
    ];

    expect(codemodCandidates({ stack: "react", sourceRoot: ROOT, findings, testedBy: {} }).map((candidate) => [candidate.pattern, candidate.files.map((file) => file.file)])).toEqual([
      ["with-router", ["a.js"]],
    ]);
  });

  it("ignora patrones de otro stack, desconocidos, otras categorias y jquery-usage fuera de react", () => {
    const findings = [legacy("each", `${ROOT}/a.php`), legacy("nope", `${ROOT}/a.js`), finding("x", `${ROOT}/a.js`, { details: { pattern: "with-router" } })];

    expect(codemodCandidates({ stack: "react", sourceRoot: ROOT, findings, testedBy: {} })).toEqual([]);
    expect(codemodCandidates({ stack: "laravel", sourceRoot: ROOT, findings: [finding("jquery-usage", `${ROOT}/a.php`, { details: { count: 2 } })], testedBy: {} })).toEqual([]);
  });

  it("orden: antes de actualizar, despues automaticos, mas archivos y patron; comando sin {paths}", () => {
    const findings = [
      legacy("lib-request", `${ROOT}/a.js`),
      legacy("lib-moment", `${ROOT}/a.js`),
      legacy("with-router", `${ROOT}/a.js`),
      legacy("with-router", `${ROOT}/b.js`),
      legacy("string-refs", `${ROOT}/a.js`),
      legacy("react-dom-render", `${ROOT}/a.js`),
      legacy("react-dom-render", `${ROOT}/b.js`),
    ];
    const candidates = codemodCandidates({ stack: "react", sourceRoot: ROOT, findings, testedBy: {} });

    expect(candidates.map((candidate) => [candidate.pattern, candidate.timing])).toEqual([
      ["string-refs", "before-upgrade"],
      ["with-router", "before-upgrade"],
      ["lib-moment", "before-upgrade"],
      ["lib-request", "before-upgrade"],
      ["react-dom-render", "after-upgrade"],
    ]);
    expect(candidates[4].command).toBe("npx codemod@latest react/19/replace-reactdom-render");
  });
});

describe("codemodCandidates: antes de actualizar va primero (XRay X6)", () => {
  it("aunque el de despues tenga herramienta y mas archivos, en cualquier orden de entrada", () => {
    const after = ["a", "b", "c"].map((name) => legacy("react-dom-render", `${ROOT}/${name}.js`));
    const before = [legacy("find-dom-node", `${ROOT}/z.js`)];
    const patterns = (findings: ReturnType<typeof legacy>[]) => codemodCandidates({ stack: "react", sourceRoot: ROOT, findings, testedBy: {} }).map((candidate) => candidate.pattern);

    expect(patterns([...after, ...before])).toEqual(["find-dom-node", "react-dom-render"]);
    expect(patterns([...before, ...after])).toEqual(["find-dom-node", "react-dom-render"]);
  });
});

describe("codemodCandidates (laravel)", () => {
  it("suma details.count y arma el comando de rector con las rutas", () => {
    const findings = [legacy("each", "/mc/lib/a.php", { count: 3 }), legacy("each", "/mc/b.php", { count: 7 }), legacy("each", "/mc/lib/a.php", { count: 2 }), legacy("lib-moment", "/mc/x.js")];

    expect(codemodCandidates({ stack: "laravel", sourceRoot: "/mc", findings, testedBy: { "/mc/b.php": ["/mc/tests/BTest.php"] } })).toEqual([
      {
        pattern: "each",
        title: "each() → foreach",
        tool: "rector",
        command: 'vendor/bin/rector process "b.php" "lib/a.php" --dry-run',
        note: "Reglas WhileEachToForeachRector y ListEachRector (PHP 7.2); otros usos de each() son manuales.",
        timing: "before-upgrade",
        files: [
          { file: "b.php", occurrences: 7, testedBy: ["tests/BTest.php"] },
          { file: "lib/a.php", occurrences: 5, testedBy: [] },
        ],
        occurrences: 12,
        protectedFiles: 1,
      },
    ]);
  });
});
