import { describe, expect, it } from "vitest";

import {
  minVersionOf,
  normalizeVersion,
  satisfiesConstraint,
  toNpmRange,
  versionGap,
} from "../../../../../app/modules/dependencies/domain/services/versioning.js";

describe("normalizeVersion", () => {
  it.each([
    ["v1.2.3", "1.2.3"],
    ["V1.2.3", "1.2.3"],
    [" 1.2.3 ", "1.2.3"],
    ["1.2", "1.2.0"],
    ["7", "7.0.0"],
    ["2.0.0-beta.1", "2.0.0-beta.1"],
    ["v2.0.0-RC1", "2.0.0-RC1"],
    ["1.2.3.4", "1.2.3"],
    ["1.2.3.45", "1.2.3"],
    ["1.2.3_x", null],
    ["dev-master", null],
    ["release-1.2", null],
    ["2.0.0-rev.1", "2.0.0-rev.1"],
    ["", null],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeVersion(raw)).toBe(expected);
  });
});

describe("toNpmRange", () => {
  it("npm queda igual", () => {
    expect(toNpmRange("~1.2", "npm")).toBe("~1.2");
    expect(toNpmRange("^1.0.0 || ^2.0.0", "npm")).toBe("^1.0.0 || ^2.0.0");
  });

  it("composer: ~X.Y (dos partes) permite hasta la siguiente major; ~X.Y.Z queda igual", () => {
    expect(toNpmRange("~1.2", "composer")).toBe(">=1.2.0 <2.0.0");
    expect(toNpmRange("~1.2.3", "composer")).toBe("~1.2.3");
    expect(toNpmRange("~10.12", "composer")).toBe(">=10.12.0 <11.0.0");
    expect(toNpmRange("~v1.2@dev", "composer")).toBe(">=1.2.0 <2.0.0");
  });

  it("composer: | y || son OR; coma y espacios son AND (espacios normalizados)", () => {
    expect(toNpmRange("^7.2|^8.0", "composer")).toBe("^7.2 || ^8.0");
    expect(toNpmRange("^7.2 || ^8.0", "composer")).toBe("^7.2 || ^8.0");
    expect(toNpmRange(">=7.1,<8.0", "composer")).toBe(">=7.1 <8.0");
    expect(toNpmRange(">=7.1 ,  <8.0", "composer")).toBe(">=7.1 <8.0");
  });

  it("composer: quita flags de estabilidad y la v de cada version", () => {
    expect(toNpmRange("^1.0@dev", "composer")).toBe("^1.0");
    expect(toNpmRange("v2.1.*@stable", "composer")).toBe("2.1.*");
    expect(toNpmRange(">=v5.3.6", "composer")).toBe(">=5.3.6");
    expect(toNpmRange("*", "composer")).toBe("*");
    expect(toNpmRange("1.0 - 2.0", "composer")).toBe("1.0 - 2.0");
  });
});

describe("satisfiesConstraint", () => {
  it("evalua con las reglas del ecosistema", () => {
    expect(satisfiesConstraint("1.9.0", "~1.2", "composer")).toBe(true);
    expect(satisfiesConstraint("1.9.0", "~1.2", "npm")).toBe(false);
    expect(satisfiesConstraint("8.1.2", "^7.2|^8.0", "composer")).toBe(true);
    expect(satisfiesConstraint("7.0.0", ">=7.1,<8.0", "composer")).toBe(false);
  });

  it("no acepta prereleases fuera del rango ni versiones o rangos invalidos", () => {
    expect(satisfiesConstraint("2.0.0-beta.1", "^1.0.0 || >=1.5.0", "npm")).toBe(false);
    expect(satisfiesConstraint("nope", "^1.0.0", "npm")).toBe(false);
    expect(satisfiesConstraint("1.0.0", "not a range !!", "npm")).toBe(false);
  });
});

describe("minVersionOf", () => {
  it("menor version que cumple; invalido → null", () => {
    expect(minVersionOf("^8.1", "composer")).toBe("8.1.0");
    expect(minVersionOf(">=18.18", "npm")).toBe("18.18.0");
    expect(minVersionOf("~1.2", "composer")).toBe("1.2.0");
    expect(minVersionOf("not a range !!", "npm")).toBeNull();
    expect(minVersionOf(">=2.0.0 <1.0.0", "npm")).toBeNull();
  });
});

describe("versionGap", () => {
  it.each([
    ["1.2.3", "2.0.0", "major"],
    ["1.2.3", "1.3.0", "minor"],
    ["1.2.3", "1.2.4", "patch"],
    ["1.2.3-beta", "1.2.3", "patch"],
    ["1.2.3-beta.1", "1.2.3-beta.2", "patch"],
    ["1.2.3", "1.2.4-beta", "patch"],
    ["1.2.3", "1.3.0-beta", "minor"],
    ["1.2.3", "2.0.0-rc.1", "major"],
    ["1.2.3", "1.2.3", "none"],
    ["2.0.0", "1.9.9", "none"],
  ])("%s → %s = %s", (from, to, expected) => {
    expect(versionGap(from, to)).toBe(expected);
  });
});
