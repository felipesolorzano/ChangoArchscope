import { describe, expect, it, vi } from "vitest";

import { mapOsvVulns } from "../../../../../app/modules/dependencies/infrastructure/advisories/osvDocument.js";
import { OsvAdvisoryDatabase } from "../../../../../app/modules/dependencies/infrastructure/advisories/OsvAdvisoryDatabase.js";

const vuln = (overrides: Record<string, unknown> = {}) => ({
  id: "GHSA-1",
  aliases: ["CVE-2020-28500"],
  summary: "ReDoS in lodash",
  database_specific: { severity: "MODERATE" },
  affected: [
    { package: { name: "lodash", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ introduced: "4.0.0" }, { fixed: "4.17.21" }] }], versions: ["4.0.0"] },
    { package: { name: "lodash-es", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "9.9.9" }] }] },
  ],
  ...overrides,
});

describe("mapOsvVulns", () => {
  it("toma solo los affected del paquete pedido y arma rangos, versiones, severidad y aliases", () => {
    expect(mapOsvVulns("npm", "lodash", [vuln()])).toEqual([
      {
        id: "GHSA-1",
        aliases: ["CVE-2020-28500"],
        summary: "ReDoS in lodash",
        severity: "moderate",
        ranges: [{ introduced: "4.0.0", fixed: "4.17.21", lastAffected: null }],
        versions: ["4.0.0"],
      },
    ]);
  });

  it("eventos: cada introduced abre un rango que cierra el siguiente fixed o last_affected; puede quedar abierto", () => {
    const [advisory] = mapOsvVulns("composer", "a/b", [
      vuln({
        affected: [
          {
            package: { name: "a/b", ecosystem: "Packagist" },
            ranges: [
              { type: "ECOSYSTEM", events: [{ introduced: "0" }, { last_affected: "1.8.2" }, { introduced: "2.0.0" }, { fixed: "2.1.0" }, { introduced: "3.0.0" }] },
              { type: "GIT", events: [{ introduced: "abc" }, { fixed: "def" }] },
            ],
          },
          { package: { name: "a/b", ecosystem: "Packagist" }, versions: ["9.0.0"] },
        ],
      }),
    ]);

    expect(advisory.ranges).toEqual([
      { introduced: "0.0.0", fixed: null, lastAffected: "1.8.2" },
      { introduced: "2.0.0", fixed: "2.1.0", lastAffected: null },
      { introduced: "3.0.0", fixed: null, lastAffected: null },
    ]);
    expect(advisory.versions).toEqual(["9.0.0"]);
  });

  it("normaliza versiones y descarta tramos o versiones ilegibles", () => {
    const [advisory] = mapOsvVulns("npm", "x", [
      vuln({
        affected: [
          {
            package: { name: "x", ecosystem: "npm" },
            ranges: [
              { type: "SEMVER", events: [{ introduced: "v1.0" }, { fixed: "1.2" }] },
              { type: "SEMVER", events: [{ introduced: "abc" }, { fixed: "2.0.0" }] },
              { type: "SEMVER", events: [{ introduced: "3.0.0" }, { fixed: "zzz" }] },
              { type: "SEMVER", events: [{ introduced: "4.0.0" }, { last_affected: "zzz" }] },
            ],
            versions: ["v1.1", "dev-master"],
          },
        ],
      }),
    ]);

    expect(advisory.ranges).toEqual([{ introduced: "1.0.0", fixed: "1.2.0", lastAffected: null }]);
    expect(advisory.versions).toEqual(["1.1.0"]);
  });

  it("severidad: medium → moderate, ausente u otra → unknown; sin aliases → []; summary cae a details recortado", () => {
    const severity = (value?: string) => mapOsvVulns("npm", "lodash", [vuln({ database_specific: value === undefined ? undefined : { severity: value } })])[0].severity;

    expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(severity)).toEqual(["critical", "high", "moderate", "low"]);
    expect(severity()).toBe("unknown");
    expect(severity("WHATEVER")).toBe("unknown");

    const [noText] = mapOsvVulns("npm", "lodash", [vuln({ aliases: undefined, summary: undefined, details: "x".repeat(300) })]);
    expect(noText.aliases).toEqual([]);
    expect(noText.summary).toBe("x".repeat(200));
    expect(mapOsvVulns("npm", "lodash", [vuln({ summary: undefined })])[0].summary).toBe("");
  });

  it("descarta vulns sin affected del paquete; acepta affected sin ranges", () => {
    expect(mapOsvVulns("npm", "other", [vuln()])).toEqual([]);
    expect(mapOsvVulns("npm", "lodash", [vuln({ affected: undefined })])).toEqual([]);
    expect(mapOsvVulns("npm", "lodash", [vuln({ affected: [{ versions: ["1.0.0"] }] })])).toEqual([]);
    expect(mapOsvVulns("composer", "lodash", [vuln()])).toEqual([]);
    expect(mapOsvVulns("npm", "lodash", [vuln({ affected: [{ package: { name: "lodash", ecosystem: "npm" } }] })])[0]).toMatchObject({ ranges: [], versions: [] });
  });
});

describe("OsvAdvisoryDatabase", () => {
  it("hace POST por paquete con el ecosistema de OSV y sigue la paginacion", async () => {
    const fetchJson = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, body: { vulns: [vuln({ id: "A" })], next_page_token: "p2" } })
      .mockResolvedValueOnce({ status: 200, body: { vulns: [vuln({ id: "B" })] } });

    const advisories = await new OsvAdvisoryDatabase(fetchJson).fetch("npm", "lodash");

    expect(advisories.map((advisory) => advisory.id)).toEqual(["A", "B"]);
    expect(fetchJson).toHaveBeenNthCalledWith(1, "https://api.osv.dev/v1/query", { method: "POST", body: { package: { name: "lodash", ecosystem: "npm" } } });
    expect(fetchJson).toHaveBeenNthCalledWith(2, "https://api.osv.dev/v1/query", { method: "POST", body: { package: { name: "lodash", ecosystem: "npm" }, page_token: "p2" } });
  });

  it("composer usa Packagist; respuesta vacia → []; status fuera de 2xx lanza", async () => {
    const fetchJson = vi.fn(async () => ({ status: 200, body: {} }));
    await expect(new OsvAdvisoryDatabase(fetchJson).fetch("composer", "a/b")).resolves.toEqual([]);
    expect(fetchJson).toHaveBeenCalledWith("https://api.osv.dev/v1/query", { method: "POST", body: { package: { name: "a/b", ecosystem: "Packagist" } } });

    await expect(new OsvAdvisoryDatabase(async () => ({ status: 503, body: null })).fetch("npm", "x")).rejects.toThrow("HTTP 503 en https://api.osv.dev/v1/query");
    await expect(new OsvAdvisoryDatabase(async () => ({ status: 300, body: null })).fetch("npm", "x")).rejects.toThrow("HTTP 300");
    await expect(new OsvAdvisoryDatabase(async () => ({ status: 199, body: null })).fetch("npm", "x")).rejects.toThrow("HTTP 199");
  });
});
