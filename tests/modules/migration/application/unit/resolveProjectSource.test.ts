import { describe, expect, it, vi } from "vitest";

import {
  projectRootFor,
  resolveProjectSource,
  type ProjectStacks,
} from "../../../../../app/modules/migration/application/use-cases/resolveProjectSource.js";

const stacks: ProjectStacks = {
  laravel: { root: "/abs/php", extensions: [".php", ".inc"], ignoredPaths: ["**/vendor/**"] },
  react: { root: "/abs/src", extensions: [".ts", ".tsx", ".js", ".jsx"], ignoredPaths: ["**/__tests__/**"] },
};

function lister() {
  return vi.fn((root: string) => [`${root}/a`, `${root}/b`]);
}

describe("resolveProjectSource", () => {
  it("react usa el stack react y lista sus archivos con su config", () => {
    const listFiles = lister();

    const source = resolveProjectSource("react", stacks, listFiles);

    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(listFiles).toHaveBeenCalledWith("/abs/src", [".ts", ".tsx", ".js", ".jsx"], ["**/__tests__/**"]);
    expect(source).toEqual({
      target: "react",
      root: "/abs/src",
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      ignoredPaths: ["**/__tests__/**"],
      files: ["/abs/src/a", "/abs/src/b"],
    });
  });

  it("react-design usa el stack react pero conserva su target", () => {
    const listFiles = lister();

    const source = resolveProjectSource("react-design", stacks, listFiles);

    expect(listFiles).toHaveBeenCalledWith("/abs/src", stacks.react.extensions, stacks.react.ignoredPaths);
    expect(source.target).toBe("react-design");
    expect(source.root).toBe("/abs/src");
  });

  it.each(["laravel", "design", "otro"])("%s usa el stack laravel", (target) => {
    const listFiles = lister();

    const source = resolveProjectSource(target, stacks, listFiles);

    expect(listFiles).toHaveBeenCalledWith("/abs/php", [".php", ".inc"], ["**/vendor/**"]);
    expect(source).toEqual({
      target,
      root: "/abs/php",
      extensions: [".php", ".inc"],
      ignoredPaths: ["**/vendor/**"],
      files: ["/abs/php/a", "/abs/php/b"],
    });
  });
});

describe("projectRootFor", () => {
  it.each([
    ["react", "/abs/src"],
    ["react-design", "/abs/src"],
    ["laravel", "/abs/php"],
    ["design", "/abs/php"],
    ["otro", "/abs/php"],
  ])("%s -> %s", (target, root) => {
    expect(projectRootFor(target, stacks)).toBe(root);
  });
});
