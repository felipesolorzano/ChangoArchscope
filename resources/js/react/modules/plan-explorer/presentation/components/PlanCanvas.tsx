import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { AlertCircle } from "lucide-react";

import type { PlanGraphNode } from "../../domain/value-objects/PlanGraph";
import { PlanTaskCard } from "./PlanTaskCard";
import { stateColor } from "../constants/planView";

const nodeTypes = { planTask: PlanTaskCard };

interface PlanCanvasProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  nodes: Node<PlanGraphNode>[];
  edges: Edge[];
  onInit: (instance: ReactFlowInstance) => void;
}

export function PlanCanvas({ loading, error, empty, nodes, edges, onInit }: PlanCanvasProps) {
  return (
    <section className="plan-canvas">
      {loading && <div className="plan-state">Cargando plan de remediacion...</div>}

      {error && (
        <div className="plan-state plan-state--error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {!loading && !error && empty && (
        <div className="plan-state">Sin tareas: la auditoria no encontro deuda accionable. 🎉</div>
      )}

      {!loading && !error && !empty && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={26} />
          <MiniMap nodeColor={(node) => stateColor((node.data as PlanGraphNode).state)} maskColor="rgba(2, 6, 23, 0.78)" />
          <Controls />
        </ReactFlow>
      )}
    </section>
  );
}
