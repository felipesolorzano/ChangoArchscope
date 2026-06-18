import { Box, ClipboardCheck, PanelLeftClose, RefreshCcw, Search, X } from "lucide-react";
import type { ArchitectureGraph, ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";
import {
  architectureLayerColors,
  architectureLayerOrder,
} from "../constants/architectureExplorerView";
import type { FilteredArchitectureGraph } from "../utils/filterArchitectureGraph";
import { Stat } from "./Stat";

interface ArchitectureSidebarProps {
  target: ArchitectureTarget;
  graph: ArchitectureGraph | null;
  modules: string[];
  filteredGraph: FilteredArchitectureGraph;
  selectedModule: string;
  selectedLayer: string;
  query: string;
  focusedNode: ArchitectureGraphNode | null;
  selectedNode: ArchitectureGraphNode | null;
  onClose: () => void;
  onTargetChange: (target: ArchitectureTarget) => void;
  onModuleChange: (module: string) => void;
  onLayerChange: (layer: string) => void;
  onQueryChange: (query: string) => void;
  onClearFocus: () => void;
  onRefresh: () => void;
  onOpenCheck: () => void;
}

export function ArchitectureSidebar({
  target,
  graph,
  modules,
  filteredGraph,
  selectedModule,
  selectedLayer,
  query,
  focusedNode,
  selectedNode,
  onClose,
  onTargetChange,
  onModuleChange,
  onLayerChange,
  onQueryChange,
  onClearFocus,
  onRefresh,
  onOpenCheck,
}: ArchitectureSidebarProps) {
  return (
    <aside className="architecture-sidebar" aria-hidden={false}>
      <div className="architecture-brand">
        <Box size={20} />
        <div>
          <h1>Architecture Explorer</h1>
          <p>Mapa visual de módulos, capas, archivos e imports.</p>
        </div>
        <button
          type="button"
          className="architecture-sidebar-toggle"
          onClick={onClose}
          aria-label="Cerrar panel lateral"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="architecture-controls">
        <label>
          Target
          <select
            value={target}
            onChange={(event) => onTargetChange(event.target.value as ArchitectureTarget)}
          >
            <option value="laravel">Laravel</option>
            <option value="react">React</option>
          </select>
        </label>

        <label>
          Módulo
          <select value={selectedModule} onChange={(event) => onModuleChange(event.target.value)}>
            <option value="">Todos</option>
            {modules.map((module) => (
              <option value={module} key={module}>
                {module}
              </option>
            ))}
          </select>
        </label>

        <label>
          Capa
          <select value={selectedLayer} onChange={(event) => onLayerChange(event.target.value)}>
            <option value="">Todas</option>
            {architectureLayerOrder.map((layer) => (
              <option value={layer} key={layer}>
                {layer}
              </option>
            ))}
          </select>
        </label>

        <label>
          Buscar
          <span className="architecture-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="PostController, Provider..."
            />
          </span>
        </label>

        <button className="architecture-refresh" onClick={onRefresh}>
          <RefreshCcw size={16} />
          Actualizar
        </button>

        <button className="architecture-check-button" onClick={onOpenCheck}>
          <ClipboardCheck size={16} />
          Check
        </button>
      </div>

      {graph && (
        <div className="architecture-stats">
          <Stat label="Módulos" value={graph.summary.modules} />
          <Stat label="Nodos" value={filteredGraph.nodes.length} />
          <Stat label="Edges" value={filteredGraph.edges.length} />
          <Stat label="Cross-module" value={graph.summary.cross_module_edges} />
        </div>
      )}

      {focusedNode && (
        <div className="architecture-focus">
          <div>
            <span>Conexiones de</span>
            <strong>{focusedNode.label}</strong>
          </div>
          <button type="button" onClick={onClearFocus} aria-label="Cerrar foco">
            <X size={16} />
            Cerrar
          </button>
        </div>
      )}

      <div className="architecture-legend">
        {["module", ...architectureLayerOrder].map((layer) => (
          <span key={layer}>
            <i style={{ background: architectureLayerColors[layer] }} />
            {layer}
          </span>
        ))}
      </div>

      {selectedNode && (
        <div className="architecture-inspector">
          <strong>{selectedNode.label}</strong>
          <span>{selectedNode.path}</span>
        </div>
      )}
    </aside>
  );
}
