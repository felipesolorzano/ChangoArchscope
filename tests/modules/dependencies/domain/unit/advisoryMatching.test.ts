import { describe, expect, it } from "vitest";

import { assessSecurity, isAffected } from "../../../../../app/modules/dependencies/domain/services/advisoryMatching.js";
import type { Advisory } from "../../../../../app/modules/dependencies/domain/value-objects/Security.js";

const advisory = (overrides: Partial<Advisory> = {}): Advisory => ({
  id: "GHSA-1",
  aliases: [],
  summary: "s",
  severity: "moderate",
  ranges: [],
  versions: [],
  ...overrides,
});

describe("isAffected", () => {
  it("rango con fixed: desde introduced hasta antes de fixed", () => {
    const a = advisory({ ranges: [{ introduced: "4.0.0", fixed: "4.17.21", lastAffected: null }] });

    expect(isAffected("3.9.9", a)).toBe(false);
    expect(isAffected("4.0.0", a)).toBe(true);
    expect(isAffected("4.17.20", a)).toBe(true);
    expect(isAffected("4.17.21", a)).toBe(false);
  });

  it("introduced 0.0.0 es desde el inicio; last_affected incluye esa version; sin cierre queda abierto", () => {
    const last = advisory({ ranges: [{ introduced: "0.0.0", fixed: null, lastAffected: "1.8.2" }] });
    const open = advisory({ ranges: [{ introduced: "2.0.0", fixed: null, lastAffected: null }] });

    expect(isAffected("0.1.0", last)).toBe(true);
    expect(isAffected("1.8.2", last)).toBe(true);
    expect(isAffected("1.8.3", last)).toBe(false);
    expect(isAffected("1.9.9", open)).toBe(false);
    expect(isAffected("99.0.0", open)).toBe(true);
  });

  it("cualquier rango alcanza; tambien la lista explicita de versiones", () => {
    const a = advisory({
      ranges: [
        { introduced: "1.0.0", fixed: "1.2.0", lastAffected: null },
        { introduced: "2.0.0", fixed: "2.1.0", lastAffected: null },
      ],
      versions: ["3.0.0"],
    });

    expect(isAffected("2.0.5", a)).toBe(true);
    expect(isAffected("1.5.0", a)).toBe(false);
    expect(isAffected("3.0.0", a)).toBe(true);
  });

  it("version invalida no esta afectada", () => {
    expect(isAffected("dev-master", advisory({ ranges: [{ introduced: "0.0.0", fixed: null, lastAffected: null }] }))).toBe(false);
  });
});

describe("assessSecurity", () => {
  const advisories = [
    advisory({ id: "B", severity: "moderate", aliases: ["GHSA-x", "CVE-2020-1"], ranges: [{ introduced: "0.0.0", fixed: "1.5.0", lastAffected: null }, { introduced: "0.0.0", fixed: "1.3.0", lastAffected: null }] }),
    advisory({ id: "A", severity: "moderate", ranges: [{ introduced: "0.0.0", fixed: null, lastAffected: "1.8.2" }] }),
    advisory({ id: "C", severity: "critical", ranges: [{ introduced: "1.0.0", fixed: "1.1.0", lastAffected: null }, { introduced: "1.2.0", fixed: "2.0.0", lastAffected: null }] }),
    advisory({ id: "D", severity: "low", ranges: [{ introduced: "5.0.0", fixed: null, lastAffected: null }] }),
    advisory({ id: "E", severity: "unknown", ranges: [{ introduced: "0.0.0", fixed: "9.0.0", lastAffected: null }] }),
    advisory({ id: "F", severity: "high", ranges: [{ introduced: "0.0.0", fixed: "9.0.0", lastAffected: null }] }),
    advisory({ id: "G", severity: "low", ranges: [{ introduced: "0.0.0", fixed: "9.0.0", lastAffected: null }] }),
  ];

  it("vulnerabilidades de la actual, ordenadas por severidad e id, con CVE y version que corrige", () => {
    const assessment = assessSecurity("1.2.5", "3.0.0", advisories);

    expect(assessment.vulnerabilities).toEqual([
      { id: "C", cve: null, summary: "s", severity: "critical", fixedIn: "2.0.0" },
      { id: "F", cve: null, summary: "s", severity: "high", fixedIn: "9.0.0" },
      { id: "A", cve: null, summary: "s", severity: "moderate", fixedIn: null },
      { id: "B", cve: "CVE-2020-1", summary: "s", severity: "moderate", fixedIn: "1.3.0" },
      { id: "G", cve: null, summary: "s", severity: "low", fixedIn: "9.0.0" },
      { id: "E", cve: null, summary: "s", severity: "unknown", fixedIn: "9.0.0" },
    ]);
    expect(assessment.maxSeverity).toBe("critical");
  });

  it("fixedIn es el menor fixed mayor que la actual", () => {
    expect(assessSecurity("1.4.0", null, [advisories[0]]).vulnerabilities[0].fixedIn).toBe("1.5.0");
  });

  it("recommendedAffected si alguna advisory afecta la recomendada", () => {
    expect(assessSecurity("1.2.5", "3.0.0", advisories).recommendedAffected).toBe(true);
    expect(assessSecurity("1.2.5", "9.0.0", advisories.slice(0, 3)).recommendedAffected).toBe(false);
    expect(assessSecurity("1.2.5", null, advisories).recommendedAffected).toBe(false);
  });

  it("sin version actual o sin advisories que la afecten no hay vulnerabilidades", () => {
    expect(assessSecurity(null, "1.0.0", advisories)).toEqual({ vulnerabilities: [], maxSeverity: null, recommendedAffected: true });
    expect(assessSecurity("9.5.0", "9.5.0", advisories.slice(0, 3))).toEqual({ vulnerabilities: [], maxSeverity: null, recommendedAffected: false });
  });
});
