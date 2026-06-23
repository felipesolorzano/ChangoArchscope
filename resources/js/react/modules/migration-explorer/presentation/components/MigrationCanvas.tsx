import { Background, Controls, ReactFlow, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import { AlertCircle } from "lucide-react";

import { BcModuleCard } from "./BcModuleCard";
import { BcLayerCard } from "./BcLayerCard";
import { BcFileCard } from "./BcFileCard";

const nodeTypes = { bcModule: BcModuleCard, bcLayer: BcLayerCard, bcFile: BcFileCard };

interface MigrationCanvasProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  nodes: Node[];
  edges: Edge[];
  onInit: (instance: ReactFlowInstance) => void;
}

export function MigrationCanvas({ loading, error, empty, nodes, edges, onInit }: MigrationCanvasProps) {
  return (
    <section className="mig-canvas">
      {loading && <div className="mig-state">Cargando mapa de bounded contexts...</div>}
      {error && (
        <div className="mig-state mig-state--error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {!loading && !error && empty && (
        <div className="mig-state">
          Aún no hay mapa. Pídele a un agente que genere el mapa de bounded contexts y lo guarde
          (ver <code>docs/bounded-context-map-schema.md</code>).
        </div>
      )}
      {!loading && !error && !empty && (
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={onInit} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} proOptions={{ hideAttribution: true }}>
          <Background color="#1e293b" gap={26} />
          <Controls />
        </ReactFlow>
      )}
    </section>
  );
}
