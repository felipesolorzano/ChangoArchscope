import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeDragHandler,
  type NodeMouseHandler,
  type OnNodesChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { AlertCircle, PanelLeftOpen } from "lucide-react";
import type { ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";
import { ArchitectureNodeCard } from "../../infrastructure/react-flow/ArchitectureNodeCard";
import { architectureLayerColors } from "../constants/architectureExplorerView";

const nodeTypes = {
  architectureNode: ArchitectureNodeCard,
};

interface ArchitectureCanvasProps {
  sidebarOpen: boolean;
  loading: boolean;
  error: string | null;
  nodes: Node<ArchitectureGraphNode>[];
  edges: Edge[];
  onOpenSidebar: () => void;
  onInit: (instance: ReactFlowInstance) => void;
  onNodesChange: OnNodesChange<Node<ArchitectureGraphNode>>;
  onNodeClick: NodeMouseHandler;
  onNodeDragStop: NodeDragHandler;
}

// Color del nodo en el minimapa: por capa (modulos aparte), gris si no hay color (p. ej. sin capa).
export function minimapNodeColor(data: ArchitectureGraphNode): string {
  return architectureLayerColors[data.type === "module" ? "module" : String(data.layer)] ?? "#94a3b8";
}

export function ArchitectureCanvas({ sidebarOpen, loading, error, onOpenSidebar, ...flow }: ArchitectureCanvasProps) {
  return (
    <section className="architecture-canvas" style={{ width: "100%", height: "100vh", minHeight: "720px" }}>
      {!sidebarOpen && (
        <button type="button" className="architecture-sidebar-open" onClick={onOpenSidebar} aria-label="Abrir panel lateral">
          <PanelLeftOpen size={18} />
          Panel
        </button>
      )}

      {loading && <div className="architecture-state">Cargando grafo...</div>}

      {error && (
        <div className="architecture-state architecture-state--error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {!loading && !error && <ArchitectureFlow {...flow} />}
    </section>
  );
}

type ArchitectureFlowProps = Pick<ArchitectureCanvasProps, "nodes" | "edges" | "onInit" | "onNodesChange" | "onNodeClick" | "onNodeDragStop">;

function ArchitectureFlow({ nodes, edges, onInit, onNodesChange, onNodeClick, onNodeDragStop }: ArchitectureFlowProps) {
  return (
    <div className="architecture-flow-frame" style={{ width: "100%", height: "100%", minHeight: "720px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        style={{ width: "100%", height: "100%" }}
      >
        <Background color="#334155" gap={22} />
        <MiniMap nodeColor={(node) => minimapNodeColor(node.data as ArchitectureGraphNode)} maskColor="rgba(2, 6, 23, 0.72)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
