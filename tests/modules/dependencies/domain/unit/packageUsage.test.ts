import { describe, expect, it } from "vitest";

import { isReferenced, isTooling, referencedPackages, usageOf } from "../../../../../app/modules/dependencies/domain/services/packageUsage.js";

describe("isReferenced", () => {
  it("literal entre comillas, backticks o con subruta", () => {
    expect(isReferenced(`import React from "react";`, "react")).toBe(true);
    expect(isReferenced(`require('react-dom/client')`, "react-dom")).toBe(true);
    expect(isReferenced("import(`lodash/get`)", "lodash")).toBe(true);
    expect(isReferenced("const x = 'lodash'", "lodash")).toBe(true);
    expect(isReferenced("const x = `lodash`", "lodash")).toBe(true);
    expect(isReferenced(`import "bootstrap/dist/css/bootstrap.min.css";`, "bootstrap")).toBe(true);
  });

  it("no cuenta prefijos de otro paquete ni texto suelto", () => {
    expect(isReferenced(`import x from "react-dom";`, "react")).toBe(false);
    expect(isReferenced(`// usamos react aqui`, "react")).toBe(false);
    expect(isReferenced(`import x from "preact";`, "react")).toBe(false);
  });
});

describe("referencedPackages", () => {
  it("reduce cada literal sin espacios a su paquete (con scope o subruta)", () => {
    const source = `import a from "react-dom/client"; import b from '@a/b/c'; const c = \`lodash\`; const d = "hola mundo"; const e = "x" + 'y';`;

    expect([...referencedPackages(source)].sort()).toEqual(["@a/b", "lodash", "react-dom", "x", "y"]);
  });
});

describe("isTooling", () => {
  it("prefijos, sufijos y exactos de herramientas", () => {
    const tooling = [
      "@types/node", "@babel/core", "@typescript-eslint/parser", "@testing-library/react", "@svgr/webpack", "@vitejs/plugin-react",
      "@vitest/coverage-v8", "@jest/globals", "eslint", "eslint-plugin-react", "babel-eslint", "jest-resolve", "webpack-dev-server",
      "postcss-flexbugs-fixes", "stylelint", "prettier", "ts-node", "sass-loader", "html-webpack-plugin", "typescript", "vite",
      "vitest", "sass", "node-sass", "tsx",
    ];

    expect(tooling.filter((name) => !isTooling(name))).toEqual([]);
    expect(["react", "lodash", "detect-browser", "semver", "@stripe/stripe-js", "loader-utils", "plugin-x"].filter(isTooling)).toEqual([]);
  });
});

describe("usageOf", () => {
  const sources = [`import a from "detect-browser";`, `const b = require("detect-browser/es");`, `import "react";`].map(referencedPackages);

  it("cuenta archivos, detecta el manifiesto y marca sin uso solo si no es herramienta", () => {
    expect(usageOf("detect-browser", false, sources, "{}")).toEqual({ files: 2, inManifest: false, unused: false });
    expect(usageOf("react-scripts", false, sources, `{"scripts":{"start":"react-scripts start"}}`)).toEqual({ files: 0, inManifest: true, unused: false });
    expect(usageOf("write", false, sources, "{}")).toEqual({ files: 0, inManifest: false, unused: true });
    expect(usageOf("eslint-plugin-react", false, sources, "{}")).toEqual({ files: 0, inManifest: false, unused: false });
    expect(usageOf("write", true, sources, "{}")).toEqual({ files: 0, inManifest: false, unused: false });
  });

  it("en el manifiesto cuenta como palabra, no como parte de otro nombre", () => {
    const manifest = (text: string) => usageOf("react", false, [], text).inManifest;

    expect(manifest(`{"scripts":{"start":"react-scripts start"}}`)).toBe(false);
    expect(manifest(`{"babel":{"presets":["react-app"]}}`)).toBe(false);
    expect(manifest(`{"x":"@scope/react"}`)).toBe(false);
    expect(manifest(`{"x":"preact"}`)).toBe(false);
    expect(manifest(`{"x":"react.js"}`)).toBe(false);
    expect(manifest(`{"x":"react_x"}`)).toBe(false);
    expect(manifest(`{"x":"my.react"}`)).toBe(false);
    expect(manifest(`{"x":"my_react"}`)).toBe(false);
    expect(manifest(`{"x":"react2"}`)).toBe(false);
    expect(manifest(`{"jest":{"preset":"react"}}`)).toBe(true);
    expect(manifest(`{"babel":{"plugins":["react/jsx-runtime"]}}`)).toBe(true);
    expect(manifest(`react`)).toBe(true);
    expect(usageOf("c++", false, [], `{"x":"c++ y"}`).inManifest).toBe(true);
    expect(usageOf("c++", false, [], `{"x":"c y"}`).inManifest).toBe(false);
  });
});
