export type ArchitectureNode = {
  id: string;
  type: "module" | "file";
  label: string;
  module: string;
  layer: string | null;
  path: string;
  role: string | null;
  role_label: string | null;
};

export type ArchitectureEdge = {
  id: string;
  source: string;
  target: string;
  type: "contains" | "import";
  label: string;
  import?: string;
  line?: number;
  crossModule: boolean;
};

export type ArchitectureGraphSummary = {
  modules: number;
  nodes: number;
  edges: number;
  cross_module_edges: number;
};

export type ArchitectureGraph = {
  generated_at: string;
  summary: ArchitectureGraphSummary;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};
