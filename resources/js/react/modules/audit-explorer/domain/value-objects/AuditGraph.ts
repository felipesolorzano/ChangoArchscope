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
  badges: string[];
  drill: boolean;
  findings?: AuditGraphFinding[];
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
