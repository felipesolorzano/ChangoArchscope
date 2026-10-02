export type AuditGraphView = "overview" | "heatmap" | "app" | "file";

export type AuditGraphNodeType = "root" | "app" | "module" | "file" | "rule";

export type AuditGraphTone = "critical" | "high" | "medium" | "low" | "none";

export type AuditGraphAccent =
  | "security"
  | "database"
  | "complexity"
  | "testing"
  | "dead_code"
  | "coupling_low_level"
  | "php_compatibility"
  | "api_access"
  | "mixed";

export interface AuditGraphPosition {
  x: number;
  y: number;
}

export interface AuditGraphSeverityMix {
  high: number;
  medium: number;
  low: number;
}

export interface AuditGraphFinding {
  line: number;
  severity: string;
  message: string;
}

export interface AuditGraphNode {
  id: string;
  type: AuditGraphNodeType;
  label: string;
  position: AuditGraphPosition;
  size: number;
  tone: AuditGraphTone;
  accent: AuditGraphAccent;
  severityMix: AuditGraphSeverityMix;
  metrics: { findings: number; risk: number };
  byCategory: Record<string, number>;
  badges: string[];
  drill: boolean;
  findings?: AuditGraphFinding[];
  health?: AuditNodeHealth;
}

export interface AuditNodeHealth {
  files: number;
  withFindings: number;
}

export interface AuditHealthTile {
  path: string;
  label: string;
  findings: number;
  risk: number;
  tone: AuditGraphTone;
  accent: AuditGraphAccent;
}

export interface AuditHealthGroup {
  key: string;
  label: string;
  files: number;
  withFindings: number;
  tiles: AuditHealthTile[];
}

export interface AuditHealthCheck {
  category: string;
  label: string;
  findings: number;
}

export interface AuditHealth {
  summary: { files: number; healthy: number; withFindings: number; healthyPercent: number };
  checks: AuditHealthCheck[];
  groups: AuditHealthGroup[];
}

export type AuditGraphEdgeKind = "contains" | "duplicate" | "depends";

export interface AuditGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: AuditGraphEdgeKind;
}

export interface AuditGraph {
  generated_at: string;
  view: AuditGraphView;
  focus: string | null;
  summary: { nodes: number; edges: number; findings: number; risk: number };
  nodes: AuditGraphNode[];
  edges: AuditGraphEdge[];
}
