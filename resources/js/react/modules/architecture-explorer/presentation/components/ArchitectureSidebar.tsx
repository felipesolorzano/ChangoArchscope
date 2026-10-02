import { Box, ClipboardCheck, PanelLeftClose, RefreshCcw, Search, X } from "lucide-react";
import type { ArchitectureGraph, ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";
import {
  architectureLayerColors,
  architectureLayerOrder,
} from "../constants/architectureExplorerView";
import type { FilteredArchitectureGraph } from "../utils/filterArchitectureGraph";
import { ArchitectureHealthPanel } from "./ArchitectureHealthPanel";
import { Stat } from "./Stat";

export interface ArchitectureSidebarProps {
  graph: ArchitectureGraph | null;
  modules: string[];
  filteredGraph: FilteredArchitectureGraph;
  selectedModule: string;
  selectedLayer: string;
  query: string;
  focusedNode: ArchitectureGraphNode | null;
  selectedNode: ArchitectureGraphNode | null;
  onClose: () => void;
  onModuleChange: (module: string) => void;
  onLayerChange: (layer: string) => void;
  onQueryChange: (query: string) => void;
  onClearFocus: () => void;
  onRefresh: () => void;
  onOpenCheck: () => void;
}

export function ArchitectureSidebar(props: ArchitectureSidebarProps) {
  const { graph, filteredGraph, focusedNode, selectedNode, onClose, onClearFocus } = props;

  return (
    <aside className="architecture-sidebar" aria-hidden={false}>
      <div className="architecture-brand">
        <Box size={20} />
        <div>
          <h1>Architecture Explorer</h1>
          <p>Mapa visual de módulos, capas, archivos e imports.</p>
        </div>
        <button type="button" className="architecture-sidebar-toggle" onClick={onClose} aria-label="Cerrar panel lateral">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <SidebarControls {...props} />
      {graph && <SidebarStats graph={graph} filteredGraph={filteredGraph} />}
      {graph && <ArchitectureHealthPanel graph={graph} />}
      {focusedNode && <FocusBox node={focusedNode} onClear={onClearFocus} />}
      <LayerLegend />

      {selectedNode && (
        <div className="architecture-inspector">
          <strong>{selectedNode.label}</strong>
          <span>{selectedNode.path}</span>
        </div>
      )}
    </aside>
  );
}

function SidebarControls({ modules, selectedModule, selectedLayer, query, onModuleChange, onLayerChange, onQueryChange, onRefresh, onOpenCheck }: ArchitectureSidebarProps) {
  return (
    <div className="architecture-controls">
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
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="PostController, Provider..." />
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
  );
}

function SidebarStats({ graph, filteredGraph }: { graph: ArchitectureGraph; filteredGraph: FilteredArchitectureGraph }) {
  return (
    <div className="architecture-stats">
      <Stat label="Módulos" value={graph.summary.modules} />
      <Stat label="Nodos" value={filteredGraph.nodes.length} />
      <Stat label="Edges" value={filteredGraph.edges.length} />
      <Stat label="Cross-module" value={graph.summary.cross_module_edges} />
    </div>
  );
}

function FocusBox({ node, onClear }: { node: ArchitectureGraphNode; onClear: () => void }) {
  return (
    <div className="architecture-focus">
      <div>
        <span>Conexiones de</span>
        <strong>{node.label}</strong>
      </div>
      <button type="button" onClick={onClear} aria-label="Cerrar foco">
        <X size={16} />
        Cerrar
      </button>
    </div>
  );
}

function LayerLegend() {
  return (
    <div className="architecture-legend">
      {["module", ...architectureLayerOrder].map((layer) => (
        <span key={layer}>
          <i style={{ background: architectureLayerColors[layer] }} />
          {layer}
        </span>
      ))}
    </div>
  );
}
