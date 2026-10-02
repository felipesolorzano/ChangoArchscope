export type Ecosystem = "npm" | "composer";
export type RuntimeKind = "php" | "node" | "npm";
export type DependencyStatus = "up_to_date" | "patch" | "minor" | "major" | "deprecated" | "abandoned" | "unknown";

export type Severity = "critical" | "high" | "moderate" | "low" | "unknown";

export interface SupportStatus {
  product: string;
  cycle: string;
  eol: string | boolean;
  isEol: boolean;
  latestInCycle: string | null;
}

export interface RuntimeCycle {
  cycle: string;
  latest: string | null;
  eol: string | boolean;
  isEol: boolean;
}

export interface SelectedRuntime {
  kind: RuntimeKind;
  version: string | null;
  source: string;
  selected: string | null;
  support: SupportStatus | null;
  cycles: RuntimeCycle[];
}

export interface Vulnerability {
  id: string;
  cve: string | null;
  summary: string;
  severity: Severity;
  fixedIn: string | null;
}

export interface SecurityAssessment {
  vulnerabilities: Vulnerability[];
  maxSeverity: Severity | null;
  recommendedAffected: boolean;
}

export interface DependencyEntry {
  ecosystem: Ecosystem;
  name: string;
  constraint: string;
  installed: string | null;
  dev: boolean;
  manifest: string;
  current: string | null;
  latest: string | null;
  recommended: string | null;
  gap: "major" | "minor" | "patch" | "none";
  status: DependencyStatus;
  deprecation: string | null;
  replacement: string | null;
  limitedByRuntime: boolean;
  currentPublishedAt: string | null;
  latestPublishedAt: string | null;
  fetchedAt: string | null;
  lookupError: string | null;
  stale: boolean;
  security: SecurityAssessment;
  advisoryError: string | null;
  support: SupportStatus | null;
}

export interface DependencySummaryData {
  total: number;
  byStatus: Record<DependencyStatus, number>;
  limitedByRuntime: number;
  lookupErrors: number;
  vulnerable: number;
  bySeverity: Record<Severity, number>;
  endOfLife: number;
}

/** Respuesta de /dependencies.json (ver app/modules/dependencies/specs/package-registries.md). */
export interface DependencyReport {
  generatedAt: string;
  root: string;
  manifests: string[];
  skipped: Array<{ manifest: string; reason: string }>;
  runtimes: SelectedRuntime[];
  dependencies: DependencyEntry[];
  summary: DependencySummaryData;
}

export type RuntimeChoice = Partial<Record<RuntimeKind, string>>;
