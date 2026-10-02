import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../../../../app/modules/architecture/infrastructure/config/defaultConfig.js";
import { normalizeConfig } from "../../../../../app/modules/architecture/infrastructure/config/config.js";

describe("normalizeConfig", () => {
  it("resuelve modulesPath y testPaths contra la raiz del proyecto (absolutas se respetan)", () => {
    const config = normalizeConfig(
      { ...defaultConfig, react: { ...defaultConfig.react, modulesPath: "src/modules", testPaths: ["src/tests", "/abs/tests"] } },
      "/project",
    );

    expect(config.react.modulesPath).toBe("/project/src/modules");
    expect(config.react.testPaths).toEqual(["/project/src/tests", "/abs/tests"]);
    expect(config.laravel.modulesPath).toBe("/project/app/modules");
  });

  it("sin testPaths queda una lista vacia", () => {
    const { testPaths: _omit, ...react } = defaultConfig.react;

    expect(normalizeConfig({ ...defaultConfig, react }, "/project").react.testPaths).toEqual([]);
  });
});
