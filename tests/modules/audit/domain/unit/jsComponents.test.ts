import { describe, expect, it } from "vitest";

import { jsComponentsOf } from "../../../../../app/modules/audit/domain/services/jsComponents.js";
import { jsClass, jsFile, jsFunction, jsMethod } from "../../support/jsStructures.js";

describe("jsComponentsOf", () => {
  it("una clase con render es componente; su complejidad suma la de sus metodos + 1", () => {
    const file = jsFile("/src/a.js", {
      classes: [
        jsClass({
          name: "Tours",
          startLine: 3,
          endLine: 40,
          methods: [jsMethod({ name: "load", decisionPointsCount: 2 }), jsMethod({ name: "render", decisionPointsCount: 3 })],
        }),
      ],
    });

    expect(jsComponentsOf(file)).toEqual([{ name: "Tours", kind: "class", startLine: 3, endLine: 40, cyclomaticComplexity: 6 }]);
  });

  it.each(["Component", "PureComponent", "React.Component", "React.PureComponent"])(
    "una clase que extiende %s es componente aunque no tenga render",
    (base) => {
      const file = jsFile("/src/a.js", { classes: [jsClass({ name: "Base", extendsName: base })] });

      expect(jsComponentsOf(file).map((component) => component.name)).toEqual(["Base"]);
    },
  );

  it("una clase sin render que extiende otra cosa no es componente", () => {
    const file = jsFile("/src/a.js", {
      classes: [jsClass({ extendsName: "Global", methods: [jsMethod({ name: "load" })] }), jsClass({ extendsName: null })],
    });

    expect(jsComponentsOf(file)).toEqual([]);
  });

  it("una funcion de nivel superior con JSX es componente; sin JSX no", () => {
    const file = jsFile("/src/a.js", {
      functions: [
        jsFunction({ name: "Card", startLine: 2, endLine: 9, decisionPointsCount: 4, containsJsx: true }),
        jsFunction({ name: "helper", containsJsx: false }),
      ],
    });

    expect(jsComponentsOf(file)).toEqual([{ name: "Card", kind: "function", startLine: 2, endLine: 9, cyclomaticComplexity: 5 }]);
  });

  it("primero las clases y despues las funciones", () => {
    const file = jsFile("/src/a.js", {
      functions: [jsFunction({ name: "F", containsJsx: true })],
      classes: [jsClass({ name: "C", extendsName: "Component" })],
    });

    expect(jsComponentsOf(file).map((component) => component.name)).toEqual(["C", "F"]);
  });
});
