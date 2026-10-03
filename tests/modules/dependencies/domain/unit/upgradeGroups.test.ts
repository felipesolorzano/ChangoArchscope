import { describe, expect, it } from "vitest";

import { upgradeGroup } from "../../../../../app/modules/dependencies/domain/services/upgradeGroups.js";

describe("upgradeGroup", () => {
  it.each([
    ["react", "react"], ["react-dom", "react"], ["react-test-renderer", "react"], ["react-is", "react"], ["@types/react", "react"], ["@types/react-dom", "react"],
    ["eslint", "eslint"], ["eslint-plugin-react", "eslint"], ["@typescript-eslint/parser", "eslint"],
    ["jest", "jest"], ["jest-resolve", "jest"], ["babel-jest", "jest"], ["ts-jest", "jest"], ["@jest/globals", "jest"],
    ["vite", "vite"], ["vitest", "vite"], ["@vitejs/plugin-react", "vite"], ["@vitest/coverage-v8", "vite"],
    ["webpack", "webpack"], ["webpack-dev-server", "webpack"], ["gulp", "gulp"], ["gulp-less", "gulp"],
    ["@stripe/stripe-js", "@stripe"], ["@babel/core", "@babel"], ["@types/node", "@types"],
    ["react-router", "react-router"], ["react-router-dom", "react-router"], ["history", "react-router"], ["react-router-config", null],
    ["lodash", null], ["eslintrc", null],
  ])("npm %s → %s", (name, group) => {
    expect(upgradeGroup("npm", name)).toBe(group);
  });

  it("composer agrupa laravel/illuminate, symfony y por vendor", () => {
    expect(upgradeGroup("composer", "laravel/framework")).toBe("laravel");
    expect(upgradeGroup("composer", "illuminate/support")).toBe("laravel");
    expect(upgradeGroup("composer", "symfony/console")).toBe("symfony");
    expect(upgradeGroup("composer", "phpoffice/phpexcel")).toBe("phpoffice");
    expect(upgradeGroup("composer", "sinvendor")).toBeNull();
  });
});
