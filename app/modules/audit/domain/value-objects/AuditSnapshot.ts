export type AuditFindingSeverity = "low" | "medium" | "high" | "critical";

export type AuditFindingSource = "architecture" | "native";

export type AuditFinding = {
  category: string;
  rule: string;
  severity: AuditFindingSeverity;
  source: AuditFindingSource;
  module: string;
  class: string | null;
  file: string;
  line: number;
  message: string;
  suggestion?: string;
  details: Record<string, unknown>;
};

export type RiskScore = {
  value: number;
  breakdown: Record<string, number>;
};

export type RiskEntry = {
  key: string;
  value: number;
  byCategory: Record<string, number>;
  findingsCount: number;
};

export type AuditRiskBreakdown = {
  byFile: RiskEntry[];
  byClass: RiskEntry[];
  byModule: RiskEntry[];
  topRiskiestFiles: RiskEntry[];
};

export type AuditSnapshotSummary = {
  files_scanned: number;
  modules: number;
  findings_count: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
};

export type AuditSnapshot = {
  generatedAt: string;
  target: string;
  module: string | null;
  summary: AuditSnapshotSummary;
  findings: AuditFinding[];
  riskScore: RiskScore;
  riskBreakdown: AuditRiskBreakdown;
};
