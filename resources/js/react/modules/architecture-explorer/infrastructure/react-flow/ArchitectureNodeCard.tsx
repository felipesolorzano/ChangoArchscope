import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArchitectureGraphNode } from "../../domain/value-objects/ArchitectureGraph";

const layerClass: Record<string, string> = {
  Domain: "architecture-node-domain",
  Application: "architecture-node-application",
  Infrastructure: "architecture-node-infrastructure",
  Presentation: "architecture-node-presentation",
  module: "architecture-node-module",
};

export function ArchitectureNodeCard({ data }: NodeProps) {
  const node = data as unknown as ArchitectureGraphNode;
  const kind = node.type === "module" ? "module" : node.layer ?? "file";
  const className = layerClass[kind] ?? "architecture-node-file";
  const role = node.role_label;

  return (
    <div className={`architecture-node ${className}`} title={node.path}>
      <Handle
        type="target"
        position={Position.Left}
        className="architecture-node__handle architecture-node__handle--target"
      />
      <div className="architecture-node__label">{node.label}</div>
      <div className="architecture-node__meta">
        <span>{node.type === "module" ? "Module" : `${node.module} / ${node.layer ?? "File"}`}</span>
        {role && <span className="architecture-node__role">{role}</span>}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="architecture-node__handle architecture-node__handle--source"
      />
    </div>
  );
}
