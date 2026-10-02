import { describe, expect, it } from "vitest";

import { mapNpmDocument } from "../../../../../app/modules/dependencies/infrastructure/registry/npmDocument.js";
import { expandMinified, mapPackagistDocument } from "../../../../../app/modules/dependencies/infrastructure/registry/packagistDocument.js";

describe("mapNpmDocument", () => {
  it("una release por version con deprecated, engines string y fecha", () => {
    const info = mapNpmDocument("request", {
      versions: {
        "2.88.0": { version: "2.88.0", engines: { node: ">= 4" } },
        "2.88.2": { version: "2.88.2", deprecated: "request has been deprecated", engines: { node: ">= 6", npm: ">=3" } },
        "1.0.0": { version: "1.0.0", deprecated: "", engines: ["node >= 0.4"] },
      },
      time: { "2.88.0": "2018-07-01T00:00:00.000Z", "2.88.2": "2020-02-11T16:35:36.122Z" },
    });

    expect(info).toStrictEqual({
      ecosystem: "npm",
      name: "request",
      abandoned: null,
      releases: [
        { version: "2.88.0", deprecated: null, requires: { node: ">= 4" }, publishedAt: "2018-07-01T00:00:00.000Z" },
        { version: "2.88.2", deprecated: "request has been deprecated", requires: { node: ">= 6", npm: ">=3" }, publishedAt: "2020-02-11T16:35:36.122Z" },
        { version: "1.0.0", deprecated: null, requires: {}, publishedAt: null },
      ],
    });
  });

  it("sin versions ni time devuelve releases vacias", () => {
    expect(mapNpmDocument("x", {})).toEqual({ ecosystem: "npm", name: "x", abandoned: null, releases: [] });
  });
});

describe("expandMinified", () => {
  it("cada entrada hereda de la anterior expandida y __unset borra la clave", () => {
    expect(
      expandMinified([
        { version: "3.0.0", require: { php: ">=8.1" }, funding: ["x"], time: "t3" },
        { version: "2.0.0", time: "t2" },
        { version: "1.0.0", require: { php: ">=5.3" }, funding: "__unset", time: "t1" },
        { version: "0.9.0", time: "t0" },
      ]),
    ).toEqual([
      { version: "3.0.0", require: { php: ">=8.1" }, funding: ["x"], time: "t3" },
      { version: "2.0.0", require: { php: ">=8.1" }, funding: ["x"], time: "t2" },
      { version: "1.0.0", require: { php: ">=5.3" }, time: "t1" },
      { version: "0.9.0", require: { php: ">=5.3" }, time: "t0" },
    ]);
  });
});

describe("mapPackagistDocument", () => {
  it("expande, toma require.php y time, y abandoned de la release mas nueva", () => {
    const info = mapPackagistDocument("phpoffice/phpexcel", {
      minified: "composer/2.0",
      packages: {
        "phpoffice/phpexcel": [
          { version: "1.8.2", require: { php: "^5.2|^7.0", "ext-xml": "*" }, abandoned: "phpoffice/phpspreadsheet", time: "2018-11-22T23:07:24+00:00" },
          { version: "1.8.1", require: { "ext-xml": "*" }, abandoned: "__unset" },
        ],
      },
    });

    expect(info).toStrictEqual({
      ecosystem: "composer",
      name: "phpoffice/phpexcel",
      abandoned: "phpoffice/phpspreadsheet",
      releases: [
        { version: "1.8.2", deprecated: null, requires: { php: "^5.2|^7.0" }, publishedAt: "2018-11-22T23:07:24+00:00" },
        { version: "1.8.1", deprecated: null, requires: {}, publishedAt: "2018-11-22T23:07:24+00:00" },
      ],
    });
  });

  it("abandoned true se conserva; sin abandoned es null; sin entradas no hay releases", () => {
    const doc = (abandoned?: unknown) => ({ packages: { "a/b": [{ version: "1.0.0", ...(abandoned === undefined ? {} : { abandoned }) }] } });

    expect(mapPackagistDocument("a/b", doc(true)).abandoned).toBe(true);
    expect(mapPackagistDocument("a/b", doc()).abandoned).toBeNull();
    expect(mapPackagistDocument("a/b", doc(false)).abandoned).toBeNull();
    expect(mapPackagistDocument("a/b", { packages: {} })).toEqual({ ecosystem: "composer", name: "a/b", abandoned: null, releases: [] });
    expect(mapPackagistDocument("a/b", {}).releases).toEqual([]);
  });
});
