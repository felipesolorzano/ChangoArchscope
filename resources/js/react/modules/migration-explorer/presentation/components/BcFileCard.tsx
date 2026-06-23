import { Handle, Position, type NodeProps } from "@xyflow/react";

import { LAYER_KEYS, type LayerKey } from "../../domain/value-objects/BoundedContextMap";
import type { FileNodeData } from "../../infrastructure/react-flow/mapToFlow";
import { layerColor, layerLabel } from "../constants/migrationView";
import { useMigrationStore } from "../store/migrationStore";

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function BcFileCard({ data }: NodeProps) {
  const { moduleKey, layer, file } = data as unknown as FileNodeData;
  const moveFile = useMigrationStore((state) => state.moveFile);

  return (
    <div className="bc-file" style={{ borderColor: layerColor(layer) }}>
      <Handle type="target" position={Position.Top} className="bc-handle" />
      <span className="bc-file__path" title={file.path}>{baseName(file.path)}</span>
      {file.note && <span className="bc-file__note">{file.note}</span>}
      <select
        className="bc-file__move"
        value={layer}
        onChange={(event) => moveFile(moduleKey, layer, file.path, event.target.value as LayerKey)}
        onClick={(event) => event.stopPropagation()}
      >
        {LAYER_KEYS.map((option) => (
          <option key={option} value={option}>
            {layerLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
