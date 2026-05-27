import React from "react";
import { createRoot } from "react-dom/client";
import ArchitectureExplorer from "./interfaces/pages/ArchitectureExplorer";
import { createArchitectureExplorerDependencies } from "./infrastructure/factory/createArchitectureExplorerDependencies";

const architectureExplorer = document.getElementById("react-component-architecture-explorer");

if (architectureExplorer instanceof HTMLElement) {
  const dependencies = createArchitectureExplorerDependencies({
    graphUrl: architectureExplorer.dataset.graphUrl ?? "/graph.json",
    checkUrl: architectureExplorer.dataset.checkUrl ?? "/check.json",
  });

  createRoot(architectureExplorer).render(
    <React.StrictMode>
      <ArchitectureExplorer dependencies={dependencies} />
    </React.StrictMode>,
  );
}
