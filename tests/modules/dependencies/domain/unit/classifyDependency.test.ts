import { describe, expect, it } from "vitest";

import { classifyDependency } from "../../../../../app/modules/dependencies/domain/services/classifyDependency.js";
import type { DeclaredDependency, PackageInfo, PackageRelease } from "../../../../../app/modules/dependencies/domain/value-objects/Dependency.js";

const dep = (overrides: Partial<DeclaredDependency> = {}): DeclaredDependency => ({
  ecosystem: "npm",
  name: "lib",
  constraint: "^1.0.0",
  installed: "1.2.0",
  dev: false,
  manifest: "/p/package.json",
  ...overrides,
});

const release = (version: string, overrides: Partial<PackageRelease> = {}): PackageRelease => ({
  version,
  deprecated: null,
  requires: {},
  publishedAt: null,
  ...overrides,
});

const info = (releases: PackageRelease[], overrides: Partial<PackageInfo> = {}): PackageInfo => ({
  ecosystem: "npm",
  name: "lib",
  releases,
  abandoned: null,
  ...overrides,
});

describe("classifyDependency", () => {
  it("al dia cuando la instalada ya es la recomendada", () => {
    const report = classifyDependency(dep(), info([release("1.0.0"), release("1.2.0")]), {});

    expect(report).toEqual({
      ...dep(),
      current: "1.2.0",
      latest: "1.2.0",
      recommended: "1.2.0",
      gap: "none",
      status: "up_to_date",
      deprecation: null,
      replacement: null,
      limitedByRuntime: false,
      currentPublishedAt: null,
      latestPublishedAt: null,
    });
  });

  it("expone la fecha de la release actual y de la ultima", () => {
    const releases = [
      release("1.0.0", { publishedAt: "2018-01-01T00:00:00Z" }),
      release("1.2.0", { publishedAt: "2019-01-01T00:00:00Z" }),
      release("1.3.0", { publishedAt: "2024-05-01T00:00:00Z" }),
    ];

    expect(classifyDependency(dep(), info(releases), {})).toMatchObject({ currentPublishedAt: "2019-01-01T00:00:00Z", latestPublishedAt: "2024-05-01T00:00:00Z" });
    expect(classifyDependency(dep({ installed: "0.9.0" }), info(releases), {})).toMatchObject({ currentPublishedAt: null, latestPublishedAt: "2024-05-01T00:00:00Z" });
  });

  it("patch / minor / major segun la distancia a la recomendada; ignora prereleases", () => {
    expect(classifyDependency(dep(), info([release("1.2.0"), release("1.2.5")]), {}).status).toBe("patch");
    expect(classifyDependency(dep(), info([release("1.2.0"), release("1.4.0")]), {}).status).toBe("minor");

    const major = classifyDependency(dep(), info([release("1.2.0"), release("3.1.0"), release("4.0.0-beta.1")]), {});
    expect(major).toMatchObject({ status: "major", gap: "major", latest: "3.1.0", recommended: "3.1.0" });
  });

  it("ordena las releases por semver aunque lleguen desordenadas", () => {
    expect(classifyDependency(dep(), info([release("1.10.0"), release("1.2.0"), release("1.9.0")]), {})).toMatchObject({
      latest: "1.10.0",
      recommended: "1.10.0",
      status: "minor",
    });
  });

  it("solo la release actual decide deprecated; si todas estan deprecated no hay limite por runtime", () => {
    expect(classifyDependency(dep(), info([release("1.0.0", { deprecated: "viejo" }), release("1.2.0")]), {})).toMatchObject({
      status: "up_to_date",
      deprecation: null,
    });
    expect(classifyDependency(dep(), info([release("1.2.0", { deprecated: "x" }), release("1.3.0", { deprecated: "y" })]), {})).toMatchObject({
      recommended: null,
      limitedByRuntime: false,
      status: "deprecated",
    });
  });

  it("sin installed usa la minima del constraint como actual", () => {
    expect(classifyDependency(dep({ installed: null, constraint: "^1.1.0" }), info([release("1.1.0"), release("1.3.0")]), {})).toMatchObject({
      current: "1.1.0",
      status: "minor",
    });
    expect(classifyDependency(dep({ installed: null, constraint: "github:x/y" }), info([release("1.0.0")]), {})).toMatchObject({
      current: null,
      gap: "none",
      status: "up_to_date",
    });
  });

  it("la recomendada salta releases deprecated y respeta el runtime elegido", () => {
    const releases = [
      release("1.2.0"),
      release("2.0.0", { requires: { node: ">=14" } }),
      release("3.0.0", { requires: { node: ">=18" } }),
      release("3.1.0", { deprecated: "usa 3.0", requires: { node: ">=18" } }),
    ];

    expect(classifyDependency(dep(), info(releases), { node: "16.20.0" })).toMatchObject({
      latest: "3.1.0",
      recommended: "2.0.0",
      status: "major",
      limitedByRuntime: true,
    });
    expect(classifyDependency(dep(), info(releases), { node: "20.0.0" })).toMatchObject({ recommended: "3.0.0", limitedByRuntime: false });
    expect(classifyDependency(dep(), info(releases), {})).toMatchObject({ recommended: "3.0.0", limitedByRuntime: false });
  });

  it("evalua requires de composer con reglas de composer", () => {
    const releases = [release("1.0.0", { requires: { php: ">=5.3" } }), release("2.0.0", { requires: { php: "~7.4|^8.0" } })];
    const composerDep = dep({ ecosystem: "composer", installed: "1.0.0" });

    expect(classifyDependency(composerDep, info(releases, { ecosystem: "composer" }), { php: "7.9.0" }).recommended).toBe("2.0.0");
    expect(classifyDependency(composerDep, info(releases, { ecosystem: "composer" }), { php: "7.3.0" }).recommended).toBe("1.0.0");
  });

  it("sin ninguna release compatible no hay recomendada", () => {
    const report = classifyDependency(dep(), info([release("2.0.0", { requires: { node: ">=20" } })]), { node: "16.0.0" });

    expect(report).toMatchObject({ recommended: null, gap: "none", status: "up_to_date", limitedByRuntime: true });
  });

  it("deprecated cuando la release actual lo esta, con su mensaje", () => {
    const report = classifyDependency(dep(), info([release("1.2.0", { deprecated: "ya no se mantiene" }), release("1.3.0")]), {});

    expect(report).toMatchObject({ status: "deprecated", deprecation: "ya no se mantiene", recommended: "1.3.0" });
  });

  it("paquete entero deprecated: la actual no publicada tambien queda deprecated con el mensaje de la ultima", () => {
    const releases = [release("1.4.1", { deprecated: "Package no longer supported" }), release("1.5.0-alpha.1", { deprecated: "otro" })];

    expect(classifyDependency(dep({ installed: "1.1.1" }), info(releases), {})).toMatchObject({ status: "deprecated", deprecation: "Package no longer supported", recommended: null });
    expect(classifyDependency(dep({ installed: "1.1.1" }), info([release("1.0.0", { deprecated: "viejo" }), release("1.2.0")]), {})).toMatchObject({ status: "minor", deprecation: null });
    expect(classifyDependency(dep({ installed: "1.1.1" }), info([release("1.0.0"), release("1.2.0", { deprecated: "roto" })]), {})).toMatchObject({ deprecation: null, recommended: "1.0.0" });
  });

  it("abandonado gana a todo y expone el reemplazo si es string", () => {
    const releases = [release("1.2.0", { deprecated: "x" }), release("1.3.0")];

    expect(classifyDependency(dep(), info(releases, { abandoned: "phpoffice/phpspreadsheet" }), {})).toMatchObject({
      status: "abandoned",
      replacement: "phpoffice/phpspreadsheet",
    });
    expect(classifyDependency(dep(), info(releases, { abandoned: true }), {})).toMatchObject({ status: "abandoned", replacement: null });
  });

  it("unknown sin info o sin releases estables", () => {
    expect(classifyDependency(dep(), null, {})).toMatchObject({ status: "unknown", latest: null, recommended: null, current: "1.2.0" });
    expect(classifyDependency(dep(), info([release("2.0.0-rc.1"), release("not-a-version")]), {})).toMatchObject({ status: "unknown", latest: null });
  });
});
