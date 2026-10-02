import React, { useState } from "react";
import "@xyflow/react/dist/style.css";
import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";
import { useArchitectureFlowGraph } from "../../infrastructure/react-flow/useArchitectureFlowGraph";
import { ArchitectureCanvas } from "../components/ArchitectureCanvas";
import { ArchitectureCheckModal } from "../components/ArchitectureCheckModal";
import { ArchitectureSidebar, type ArchitectureSidebarProps } from "../components/ArchitectureSidebar";
import { useArchitectureCheckController } from "../hooks/useArchitectureCheckController";
import { useArchitectureGraphController } from "../hooks/useArchitectureGraphController";

import "./architectureExplorer.css";

interface ArchitectureExplorerProps {
  dependencies: ArchitectureProviders;
  target: ArchitectureTarget;
}

export type { ArchitectureProviders };

type GraphController = ReturnType<typeof useArchitectureGraphController>;

// Props del sidebar a partir del controlador del grafo.
function sidebarPropsFor(controller: GraphController, onClose: () => void, onOpenCheck: () => void): ArchitectureSidebarProps {
  return {
    graph: controller.graph,
    modules: controller.modules,
    filteredGraph: controller.filteredGraph,
    selectedModule: controller.selectedModule,
    selectedLayer: controller.selectedLayer,
    query: controller.query,
    focusedNode: controller.focusedNode,
    selectedNode: controller.selectedNode,
    onClose,
    onModuleChange: controller.changeModule,
    onLayerChange: controller.changeLayer,
    onQueryChange: controller.changeQuery,
    onClearFocus: () => controller.setFocusedNodeId(null),
    onRefresh: () => void controller.refresh(),
    onOpenCheck,
  };
}

export default function ArchitectureExplorer({ dependencies, target }: ArchitectureExplorerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const graphController = useArchitectureGraphController(dependencies, target);
  const checkController = useArchitectureCheckController(dependencies);
  const flowGraph = useArchitectureFlowGraph({
    filteredGraph: graphController.filteredGraph,
    focusedNodeId: graphController.focusedNodeId,
    onFocusNode: graphController.setFocusedNodeId,
  });

  function openArchitectureCheck() {
    checkController.run(graphController.selectedModule, graphController.target);
  }

  return (
    <main className={`architecture-explorer${sidebarOpen ? "" : " architecture-explorer--sidebar-closed"}`}>
      <ArchitectureSidebar {...sidebarPropsFor(graphController, () => setSidebarOpen(false), openArchitectureCheck)} />

      <ArchitectureCanvas
        sidebarOpen={sidebarOpen}
        loading={graphController.loading}
        error={graphController.error}
        nodes={flowGraph.flowNodes}
        edges={flowGraph.flowEdges}
        onOpenSidebar={() => setSidebarOpen(true)}
        onInit={flowGraph.setFlowInstance}
        onNodesChange={flowGraph.onNodesChange}
        onNodeClick={flowGraph.handleNodeClick}
        onNodeDragStop={flowGraph.handleNodeDragStop}
      />

      {checkController.open && (
        <ArchitectureCheckModal
          result={checkController.result}
          loading={checkController.loading}
          error={checkController.error}
          selectedModule={graphController.selectedModule}
          onClose={checkController.close}
          onRefresh={openArchitectureCheck}
        />
      )}
    </main>
  );
}
