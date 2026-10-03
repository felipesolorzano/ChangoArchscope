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

import type { PlanCheck } from "../../domain/value-objects/PlanGraph";
import { PlanLaneHeader } from "./PlanLaneHeader";
import { PlanTaskCard } from "./PlanTaskCard";
import { minimapNodeColor } from "../constants/phaseView";

const nodeTypes = { planTask: PlanTaskCard, planLane: PlanLaneHeader };

interface PlanCanvasProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  nodes: Node[];
  edges: Edge[];
  onInit: (instance: ReactFlowInstance) => void;
  checks?: PlanCheck[];
}

export function PlanCanvas({ loading, error, empty, nodes, edges, onInit, checks = [] }: PlanCanvasProps) {
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
        <div className="plan-state">
          Sin tareas: la auditoria no encontro deuda accionable. 🎉
          <AuditedChecklist checks={checks} />
        </div>
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
          <MiniMap nodeColor={minimapNodeColor} maskColor="rgba(2, 6, 23, 0.78)" />
          <Controls />
        </ReactFlow>
      )}
    </section>
  );
}

// Categorias auditadas: en verde las que no tienen hallazgos.
function AuditedChecklist({ checks }: { checks: PlanCheck[] }) {
  if (checks.length === 0) {
    return null;
  }

  return (
    <ul className="plan-checks">
      {checks.map((check) => (
        <li key={check.category} className={`plan-check plan-check--${check.findings === 0 ? "ok" : "bad"}`}>
          <span>{check.findings === 0 ? "✓" : check.findings}</span>
          {check.label}
        </li>
      ))}
    </ul>
  );
}
