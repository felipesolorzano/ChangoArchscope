import type {
  ArchitectureEdgeKind,
  ArchitectureGraph,
  ArchitectureLayer,
  ArchitectureNodeKind,
} from "../../domain/value-objects/ArchitectureGraph";

export interface ArchitectureGraphNodeDto {
  id: string;
  type: ArchitectureNodeKind;
  label: string;
  module: string;
  layer: ArchitectureLayer;
  path: string;
  role?: string | null;
  role_label?: string | null;
}

export interface ArchitectureGraphEdgeDto {
  id: string;
  source: string;
  target: string;
  type: ArchitectureEdgeKind;
  label: string;
  import?: string;
  line?: number;
  crossModule: boolean;
}

export interface ArchitectureGraphSummaryDto {
  modules: number;
  nodes: number;
  edges: number;
  cross_module_edges: number;
}

export interface ArchitectureGraphDto {
  generated_at: string;
  summary: ArchitectureGraphSummaryDto;
  nodes: ArchitectureGraphNodeDto[];
  edges: ArchitectureGraphEdgeDto[];
}

export function toArchitectureGraph(dto: ArchitectureGraphDto): ArchitectureGraph {
  return {
    generated_at: dto.generated_at,
    summary: {
      modules: dto.summary.modules,
      nodes: dto.summary.nodes,
      edges: dto.summary.edges,
      cross_module_edges: dto.summary.cross_module_edges,
    },
    nodes: dto.nodes.map((node) => ({ ...node })),
    edges: dto.edges.map((edge) => ({ ...edge })),
  };
}
