import React, { useState } from "react";
import "@xyflow/react/dist/style.css";
import "../../infrastructure/react-flow/reactFlowFallback.css";
import type { ArchitectureProviders } from "../../application/contracts/ArchitectureProviders";
import type { ArchitectureTarget } from "../../domain/value-objects/ArchitectureTarget";
import { useArchitectureFlowGraph } from "../../infrastructure/react-flow/useArchitectureFlowGraph";
import { ArchitectureCanvas } from "../components/ArchitectureCanvas";
import { ArchitectureCheckModal } from "../components/ArchitectureCheckModal";
import { ArchitectureSidebar } from "../components/ArchitectureSidebar";
import { useArchitectureCheckController } from "../hooks/useArchitectureCheckController";
import { useArchitectureGraphController } from "../hooks/useArchitectureGraphController";

import "./architectureExplorer.css";

interface ArchitectureExplorerProps {
  dependencies: ArchitectureProviders;
  target: ArchitectureTarget;
}

export type { ArchitectureProviders };

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
      <ArchitectureSidebar
        graph={graphController.graph}
        modules={graphController.modules}
        filteredGraph={graphController.filteredGraph}
        selectedModule={graphController.selectedModule}
        selectedLayer={graphController.selectedLayer}
        query={graphController.query}
        focusedNode={graphController.focusedNode}
        selectedNode={graphController.selectedNode}
        onClose={() => setSidebarOpen(false)}
        onModuleChange={graphController.changeModule}
        onLayerChange={graphController.changeLayer}
        onQueryChange={graphController.changeQuery}
        onClearFocus={() => graphController.setFocusedNodeId(null)}
        onRefresh={() => graphController.refresh()}
        onOpenCheck={openArchitectureCheck}
      />

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
