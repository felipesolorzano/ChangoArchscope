import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import { AlertCircle } from "lucide-react";

import type { AuditGraphNode } from "../../domain/value-objects/AuditGraph";
import { AuditNodeCard } from "../../infrastructure/react-flow/AuditNodeCard";
import { toneFill } from "../constants/auditView";

const nodeTypes = { auditNode: AuditNodeCard };

interface AuditCanvasProps {
  loading: boolean;
  error: string | null;
  nodes: Node<AuditGraphNode>[];
  edges: Edge[];
  onInit: (instance: ReactFlowInstance) => void;
  onNodeClick: NodeMouseHandler;
}

export function AuditCanvas({ loading, error, nodes, edges, onInit, onNodeClick }: AuditCanvasProps) {
  return (
    <section className="audit-canvas">
      {loading && <div className="audit-state">Cargando mapa de auditoria...</div>}

      {error && (
        <div className="audit-state audit-state--error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {!loading && !error && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={26} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => toneFill((node.data as AuditGraphNode).tone)}
            maskColor="rgba(2, 6, 23, 0.78)"
          />
          <Controls />
        </ReactFlow>
      )}
    </section>
  );
}
