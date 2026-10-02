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

export interface IncludeStats {
  total: number;
  resolved: number;
  external: number;
  unresolved: number;
  unresolvedConstants: Array<{ name: string; count: number }>;
}

export interface ArchitectureGraphSummary {
  modules: number;
  nodes: number;
  edges: number;
  cross_module_edges: number;
  /** Solo laravel: include/require resueltos (XRay X1b). */
  includes?: IncludeStats;
}

export interface ImportCycle {
  files: string[];
  path: string[];
  modules: string[];
  crossModule: boolean;
  line: number;
}

export interface FileRank {
  path: string;
  module: string;
  count: number;
}

/** Ciclos y KPIs de acoplamiento (XRay X1, ver app/modules/architecture/specs/architecture-health.md). */
export interface ArchitectureHealth {
  summary: { files: number; imports: number; crossModuleImports: number; modulePairs: number; cycles: number; filesInCycles: number; largestCycle: number };
  cycles: ImportCycle[];
  mostImported: FileRank[];
  mostImporting: FileRank[];
}

export interface ArchitectureGraph {
  generated_at: string;
  summary: ArchitectureGraphSummary;
  nodes: ArchitectureGraphNode[];
  edges: ArchitectureGraphEdge[];
  health?: ArchitectureHealth;
}
