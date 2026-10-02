import { describe, expect, it } from "vitest";

import {
  mapTargetFor,
  parseProjectTarget,
  searchWithTarget,
  targetFromSearch,
} from "../../../../../modules/app/domain/projectTarget";

describe("parseProjectTarget", () => {
  it("react es react", () => {
    expect(parseProjectTarget("react")).toBe("react");
  });

  it.each(["laravel", "React", "", null, undefined, "vue"])("%s cae a laravel", (value) => {
    expect(parseProjectTarget(value)).toBe("laravel");
  });
});

describe("targetFromSearch", () => {
  it("lee target del query string", () => {
    expect(targetFromSearch("?target=react&x=1")).toBe("react");
  });

  it("sin parametro es laravel", () => {
    expect(targetFromSearch("")).toBe("laravel");
    expect(targetFromSearch("?x=react")).toBe("laravel");
  });
});

describe("searchWithTarget", () => {
  it("agrega target preservando los demas parametros", () => {
    expect(searchWithTarget("?x=1", "react")).toBe("?x=1&target=react");
  });

  it("reemplaza un target existente", () => {
    expect(searchWithTarget("?target=react", "laravel")).toBe("?target=laravel");
  });

  it("desde un query vacio", () => {
    expect(searchWithTarget("", "react")).toBe("?target=react");
  });
});

describe("mapTargetFor", () => {
  it("laravel conserva los targets historicos", () => {
    expect(mapTargetFor("laravel", "migration")).toBe("laravel");
    expect(mapTargetFor("laravel", "design")).toBe("design");
  });

  it("react usa sus propios mapas", () => {
    expect(mapTargetFor("react", "migration")).toBe("react");
    expect(mapTargetFor("react", "design")).toBe("react-design");
  });
});
