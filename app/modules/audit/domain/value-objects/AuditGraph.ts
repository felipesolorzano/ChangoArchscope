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

export type AuditGraphPosition = {
  x: number;
  y: number;
};

export type AuditGraphSeverityMix = {
  high: number;
  medium: number;
  low: number;
};

export type AuditGraphFinding = {
  line: number;
  severity: string;
  message: string;
};

export type AuditGraphNode = {
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
  // Presente solo en nodos `rule` (vista file): muestra hasta `RULE_FINDINGS_LIMIT`
  // hallazgos reales de esa regla en ese archivo.
  findings?: AuditGraphFinding[];
};

export type AuditGraphEdgeKind = "contains" | "duplicate" | "depends";

export type AuditGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: AuditGraphEdgeKind;
};

export type AuditGraph = {
  generated_at: string;
  view: AuditGraphView;
  focus: string | null;
  summary: { nodes: number; edges: number; findings: number; risk: number };
  nodes: AuditGraphNode[];
  edges: AuditGraphEdge[];
};
