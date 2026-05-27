export type ArchitectureLayer =
  | "Domain"
  | "Application"
  | "Infrastructure"
  | "Presentation"
  | null;

export type ArchitectureNodeKind = "module" | "file";
export type ArchitectureEdgeKind = "contains" | "import";

export interface ArchitectureGraphNode {
  id: string;
  type: ArchitectureNodeKind;
  label: string;
  module: string;
  layer: ArchitectureLayer;
  path: string;
  role?: string | null;
  role_label?: string | null;
}

export interface ArchitectureGraphEdge {
  id: string;
  source: string;
  target: string;
  type: ArchitectureEdgeKind;
  label: string;
  import?: string;
  line?: number;
  crossModule: boolean;
}

export interface ArchitectureGraphSummary {
  modules: number;
  nodes: number;
  edges: number;
  cross_module_edges: number;
}

export interface ArchitectureGraph {
  generated_at: string;
  summary: ArchitectureGraphSummary;
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
}
