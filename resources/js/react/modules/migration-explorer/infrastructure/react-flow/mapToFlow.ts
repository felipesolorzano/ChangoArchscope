import type { Edge, Node } from "@xyflow/react";

import {
  LAYER_KEYS,
  moduleFileCount,
  type BoundedContextFile,
  type BoundedContextMap,
  type LayerKey,
} from "../../domain/value-objects/BoundedContextMap";

export type MigrationView = "overview" | "module";

const MODULE_GRID = 6;
const MODULE_CELL_X = 240;
const MODULE_CELL_Y = 220;
const LAYER_COL_X = 320;
const FILE_Y_START = 110;
const FILE_ROW = 70;

export interface ModuleNodeData {
  module: BoundedContextMap["modules"][number];
  fileCount: number;
}
export interface LayerNodeData {
  moduleKey: string;
  layer: LayerKey;
  count: number;
}
export interface FileNodeData {
  moduleKey: string;
  layer: LayerKey;
  file: BoundedContextFile;
}

export interface MigrationFlow {
  nodes: Node[];
  edges: Edge[];
}

export function mapToFlow(map: BoundedContextMap, view: MigrationView, focus: string | null): MigrationFlow {
  if (view === "module" && focus !== null) {
    const module = map.modules.find((item) => item.key === focus);
    if (module !== undefined) {
      return moduleFlow(module);
    }
  }

  return overviewFlow(map);
}

function overviewFlow(map: BoundedContextMap): MigrationFlow {
  const nodes: Node[] = map.modules.map((module, index) => ({
    id: `module:${module.key}`,
    type: "bcModule",
    position: {
      x: ((index % MODULE_GRID) - (Math.min(MODULE_GRID, Math.max(map.modules.length, 1)) - 1) / 2) * MODULE_CELL_X,
      y: Math.floor(index / MODULE_GRID) * MODULE_CELL_Y,
    },
    data: { module, fileCount: moduleFileCount(module) } satisfies ModuleNodeData,
    draggable: true,
  }));

  return { nodes, edges: [] };
}

function moduleFlow(module: BoundedContextMap["modules"][number]): MigrationFlow {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  LAYER_KEYS.forEach((layer, layerIndex) => {
    const x = (layerIndex - (LAYER_KEYS.length - 1) / 2) * LAYER_COL_X;
    const layerId = `layer:${module.key}:${layer}`;

    nodes.push({
      id: layerId,
      type: "bcLayer",
      position: { x, y: 0 },
      data: { moduleKey: module.key, layer, count: module.layers[layer].length } satisfies LayerNodeData,
      draggable: false,
      selectable: false,
    });

    module.layers[layer].forEach((file, fileIndex) => {
      const fileId = `file:${module.key}:${layer}:${file.path}`;

      nodes.push({
        id: fileId,
        type: "bcFile",
        position: { x, y: FILE_Y_START + fileIndex * FILE_ROW },
        data: { moduleKey: module.key, layer, file } satisfies FileNodeData,
        draggable: true,
      });

      edges.push({ id: `e:${layerId}:${fileId}`, source: layerId, target: fileId, type: "smoothstep", style: { stroke: "#475569" } });
    });
  });

  return { nodes, edges };
}
