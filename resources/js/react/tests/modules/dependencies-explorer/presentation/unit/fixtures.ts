import type { DependencyEntry, Vulnerability } from "../../../../../modules/dependencies-explorer/domain/value-objects/DependencyReport";

export const vuln = (overrides: Partial<Vulnerability> = {}): Vulnerability => ({
  id: "GHSA-1",
  cve: "CVE-2020-1",
  summary: "XSS",
  severity: "high",
  fixedIn: "2.0.0",
  ...overrides,
});

export const entry = (overrides: Partial<DependencyEntry> = {}): DependencyEntry => ({
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
  fetchedAt: "2026-10-02T00:00:00.000Z",
  lookupError: null,
  stale: false,
  security: { vulnerabilities: [], maxSeverity: null, recommendedAffected: false },
  advisoryError: null,
  support: null,
  usage: null,
  group: null,
  ...overrides,
});
