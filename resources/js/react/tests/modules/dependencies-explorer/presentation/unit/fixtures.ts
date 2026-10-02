import type { DependencyEntry } from "../../../../../modules/dependencies-explorer/domain/value-objects/DependencyReport";

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
  ...overrides,
});
