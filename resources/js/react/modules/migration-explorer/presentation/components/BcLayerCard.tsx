import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { LayerNodeData } from "../../infrastructure/react-flow/mapToFlow";
import { layerColor, layerLabel } from "../constants/migrationView";

export function BcLayerCard({ data }: NodeProps) {
  const { layer, count } = data as unknown as LayerNodeData;
  const color = layerColor(layer);

  return (
    <div className="bc-layer" style={{ borderColor: color }}>
      <span className="bc-layer__dot" style={{ background: color }} />
      <span className="bc-layer__name">{layerLabel(layer)}</span>
      <span className="bc-layer__count">{count}</span>
      <Handle type="source" position={Position.Bottom} className="bc-handle" />
    </div>
  );
}
