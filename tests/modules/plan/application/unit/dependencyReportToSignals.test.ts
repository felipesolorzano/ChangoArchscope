import { describe, expect, it } from "vitest";

import type { DependencyReportEntry, DependencyReportResult, SelectedRuntime } from "../../../../../app/modules/dependencies/application/use-cases/buildDependencyReport.js";
import { dependencyReportToSignals } from "../../../../../app/modules/plan/application/services/dependencyReportToSignals.js";

const entry = (overrides: Partial<DependencyReportEntry>): DependencyReportEntry => ({
  ecosystem: "npm",
  name: "lib",
  constraint: "^1.0.0",
  installed: "1.0.0",
  dev: false,
  manifest: "/p/package.json",
  current: "1.0.0",
  latest: "1.0.0",
  recommended: "1.0.0",
  gap: "none",
  status: "up_to_date",
  deprecation: null,
  replacement: null,
  limitedByRuntime: false,
  currentPublishedAt: null,
  latestPublishedAt: null,
  fetchedAt: null,
  lookupError: null,
  stale: false,
  security: { vulnerabilities: [], maxSeverity: null, recommendedAffected: false },
  advisoryError: null,
  support: null,
  usage: null,
  group: null,
  ...overrides,
});

const runtime = (overrides: Partial<SelectedRuntime>): SelectedRuntime => ({ kind: "node", version: "18.0.0", source: "local", selected: "18.0.0", support: null, cycles: [], ...overrides });

const vuln = (id: string, cve: string | null, severity: "high" | "moderate" | "critical" | "low" | "unknown" = "high") => ({ id, cve, summary: "s", severity, fixedIn: null });

function report(dependencies: DependencyReportEntry[], runtimes: SelectedRuntime[] = []): DependencyReportResult {
  return {
    generatedAt: "",
    root: "/p",
    manifests: [],
    skipped: [],
    runtimes,
    dependencies,
    summary: {
      total: 0,
      byStatus: { up_to_date: 0, patch: 0, minor: 0, major: 0, deprecated: 0, abandoned: 0, unknown: 0 },
      limitedByRuntime: 0,
      lookupErrors: 0,
      vulnerable: 0,
      bySeverity: { critical: 0, high: 0, moderate: 0, low: 0, unknown: 0 },
      endOfLife: 0,
      unused: 0,
    },
  };
}

describe("dependencyReportToSignals", () => {
  it("vulnerables: severidad maxima (moderate → medium) y CVE o id de la primera", () => {
    const signals = dependencyReportToSignals(
      report([
        entry({ name: "vite", current: "5.4.21", recommended: "6.4.3", security: { vulnerabilities: [vuln("GHSA-1", "CVE-1"), vuln("GHSA-2", null)], maxSeverity: "high", recommendedAffected: false } }),
        entry({ name: "vitest", current: "3.2.6", recommended: null, security: { vulnerabilities: [vuln("GHSA-3", null, "moderate")], maxSeverity: "moderate", recommendedAffected: true } }),
      ]),
    );

    expect(signals.counts["fix-vulnerable-packages"]).toBe(2);
    expect(signals.items["fix-vulnerable-packages"]).toEqual([
      { file: "/p/package.json", line: 0, rule: "dependency-vulnerable", severity: "high", message: "vite 5.4.21 → 6.4.3: 2 vulns (CVE-1)" },
      { file: "/p/package.json", line: 0, rule: "dependency-vulnerable", severity: "medium", message: "vitest 3.2.6 → -: 1 vulns (GHSA-3)" },
    ]);
  });

  it("criticas al hotfix con la version que corrige; el resto a fix-vulnerable-packages (XRay X6)", () => {
    const critical = (id: string, cve: string | null, fixedIn: string | null) => ({ id, cve, summary: "s", severity: "critical" as const, fixedIn });
    const signals = dependencyReportToSignals(
      report([
        entry({ name: "fatfree", current: "3.5.1", recommended: "3.9.3", security: { vulnerabilities: [vuln("GHSA-0", "CVE-0"), critical("GHSA-1", "CVE-1", "3.6.0"), critical("GHSA-2", null, "3.7.0")], maxSeverity: "critical", recommendedAffected: false } }),
        entry({ name: "swiper", current: "3.3.1", recommended: "14.3.0", security: { vulnerabilities: [critical("GHSA-3", null, null)], maxSeverity: "critical", recommendedAffected: false } }),
        entry({ name: "ghost", current: "1.0.0", recommended: null, security: { vulnerabilities: [critical("GHSA-4", "CVE-4", null)], maxSeverity: "critical", recommendedAffected: true } }),
        entry({ name: "vite", current: "5.4.21", recommended: "6.4.3", security: { vulnerabilities: [vuln("GHSA-5", "CVE-5")], maxSeverity: "high", recommendedAffected: false } }),
      ]),
    );

    expect(signals.items["hotfix-critical-packages"]).toEqual([
      { file: "/p/package.json", line: 0, rule: "dependency-critical", severity: "critical", message: "fatfree 3.5.1 → 3.6.0: 2 vulns criticas (CVE-1)" },
      { file: "/p/package.json", line: 0, rule: "dependency-critical", severity: "critical", message: "swiper 3.3.1 → 14.3.0: 1 vulns criticas (GHSA-3)" },
      { file: "/p/package.json", line: 0, rule: "dependency-critical", severity: "critical", message: "ghost 1.0.0 → -: 1 vulns criticas (CVE-4)" },
    ]);
    expect(signals.counts["hotfix-critical-packages"]).toBe(3);
    expect(signals.items["fix-vulnerable-packages"].map((item) => item.message)).toEqual(["vite 5.4.21 → 6.4.3: 1 vulns (CVE-5)"]);
  });

  it("runtimes sin soporte", () => {
    const signals = dependencyReportToSignals(
      report([], [
        runtime({ selected: "18.18.0", support: { product: "nodejs", cycle: "18", eol: "2025-04-30", isEol: true, latestInCycle: null } }),
        runtime({ kind: "php", selected: "8.3.6", support: { product: "php", cycle: "8.3", eol: "2027-12-31", isEol: false, latestInCycle: null } }),
        runtime({ kind: "npm", selected: "6.0.0", support: { product: "x", cycle: "6", eol: true, isEol: true, latestInCycle: null } }),
        runtime({ kind: "php", selected: null, support: null }),
        runtime({ kind: "php", selected: "7.4.33", support: { product: "php", cycle: "7.4", eol: "2022-11-28", isEol: true, latestInCycle: null } }),
      ]),
    );

    expect(signals.counts["update-unsupported-runtime"]).toBe(3);
    expect(signals.items["update-unsupported-runtime"]).toEqual([
      { file: "", line: 0, rule: "runtime-eol", severity: "high", message: "Node 18.18.0: sin soporte desde 2025-04-30" },
      { file: "", line: 0, rule: "runtime-eol", severity: "high", message: "npm 6.0.0: sin soporte" },
      { file: "", line: 0, rule: "runtime-eol", severity: "high", message: "PHP 7.4.33: sin soporte desde 2022-11-28" },
    ]);
  });

  it("abandonados/deprecated, sin uso, actualizaciones seguras y majors", () => {
    const signals = dependencyReportToSignals(
      report([
        entry({ name: "phpexcel", status: "abandoned", replacement: "phpoffice/phpspreadsheet", current: "1.8.2" }),
        entry({ name: "request", status: "deprecated", deprecation: "request has been deprecated", current: "2.88.2" }),
        entry({ name: "write", usage: { files: 0, inManifest: false, unused: true } }),
        entry({ name: "used", usage: { files: 3, inManifest: false, unused: false } }),
        entry({ name: "drizzle-orm", status: "patch", current: "0.45.2", recommended: "0.45.3" }),
        entry({ name: "tsx", status: "minor", current: "4.22.4", recommended: "4.23.15" }),
        entry({ name: "react-dom", status: "major", current: "18.3.1", recommended: "19.3.0", group: "react" }),
        entry({ name: "lucide-react", status: "major", current: "0.542.0", recommended: "1.50.0" }),
      ]),
    );

    expect(signals.counts).toEqual({
      "hotfix-critical-packages": 0,
      "fix-vulnerable-packages": 0,
      "update-unsupported-runtime": 0,
      "replace-abandoned-packages": 2,
      "remove-unused-packages": 1,
      "apply-safe-updates": 2,
      "upgrade-major-versions": 2,
      "upgrade-major:react": 1,
      "upgrade-major:otros": 1,
    });
    expect(signals.items["replace-abandoned-packages"]).toEqual([
      { file: "/p/package.json", line: 0, rule: "dependency-abandoned", severity: "high", message: "phpexcel 1.8.2: phpoffice/phpspreadsheet" },
      { file: "/p/package.json", line: 0, rule: "dependency-deprecated", severity: "high", message: "request 2.88.2: request has been deprecated" },
    ]);
    expect(signals.items["remove-unused-packages"]).toEqual([
      { file: "/p/package.json", line: 0, rule: "dependency-unused", severity: "low", message: "write: sin referencias en el codigo" },
    ]);
    expect(signals.items["apply-safe-updates"].map((item) => [item.rule, item.severity, item.message])).toEqual([
      ["dependency-patch", "low", "drizzle-orm 0.45.2 → 0.45.3"],
      ["dependency-minor", "low", "tsx 4.22.4 → 4.23.15"],
    ]);
    expect(signals.items["upgrade-major-versions"].map((item) => [item.rule, item.severity, item.message])).toEqual([
      ["dependency-major", "medium", "react-dom 18.3.1 → 19.3.0 (grupo react)"],
      ["dependency-major", "medium", "lucide-react 0.542.0 → 1.50.0"],
    ]);
  });

  it("abandonado sin reemplazo usa el aviso de deprecated o un texto generico", () => {
    const signals = dependencyReportToSignals(report([entry({ name: "x", status: "abandoned", current: "1.0.0" })]));

    expect(signals.items["replace-abandoned-packages"][0].message).toBe("x 1.0.0: abandonado");
  });
});

describe("dependencyReportToSignals: un major a la vez (XRay X6)", () => {
  it("un paso por grupo en el orden recomendado; los sueltos al final; cada paso con sus items", () => {
    const major = (name: string, group: string | null) => entry({ name, current: "1.0.0", recommended: "2.0.0", status: "major", group });
    const signals = dependencyReportToSignals(
      report([
        major("zod", null),
        major("@stripe/stripe-js", "@stripe"),
        major("react", "react"),
        major("@aws/sdk", "@aws"),
        major("@testing-library/react", "@testing-library"),
        major("react-router-dom", "react-router"),
        major("eslint", "eslint"),
        major("laravel/framework", "laravel"),
        major("gulp", "gulp"),
        major("webpack", "webpack"),
        major("vite", "vite"),
        major("jest", "jest"),
        major("react-dom", "react"),
        major("lodash", null),
        major("phpoffice/phpspreadsheet", "phpoffice"),
        entry({ name: "patchy", status: "patch", group: "react" }),
      ]),
    );

    expect(signals.majorSteps).toEqual([
      "upgrade-major:eslint",
      "upgrade-major:jest",
      "upgrade-major:vite",
      "upgrade-major:webpack",
      "upgrade-major:gulp",
      "upgrade-major:react",
      "upgrade-major:@testing-library",
      "upgrade-major:react-router",
      "upgrade-major:laravel",
      "upgrade-major:@aws",
      "upgrade-major:@stripe",
      "upgrade-major:phpoffice",
      "upgrade-major:otros",
    ]);
    expect(signals.counts["upgrade-major:react"]).toBe(2);
    expect(signals.counts["upgrade-major-versions"]).toBe(15);
    expect(signals.items["upgrade-major:react"].map((item) => [item.rule, item.severity])).toEqual([["dependency-major", "medium"], ["dependency-major", "medium"]]);
    expect(signals.items["upgrade-major:react"].map((item) => item.message)).toEqual(["react 1.0.0 → 2.0.0 (grupo react)", "react-dom 1.0.0 → 2.0.0 (grupo react)"]);
    expect(signals.items["upgrade-major:otros"].map((item) => item.message)).toEqual(["zod 1.0.0 → 2.0.0", "lodash 1.0.0 → 2.0.0"]);
  });

  it("sin majors no hay pasos", () => {
    expect(dependencyReportToSignals(report([])).majorSteps).toEqual([]);
  });
});

