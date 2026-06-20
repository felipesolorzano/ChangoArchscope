import { useState } from "react";

import ArchitectureExplorer from "../../architecture-explorer/presentation/pages/ArchitectureExplorer.js";
import { createArchitectureExplorerDependencies } from "../../architecture-explorer/infrastructure/factory/createArchitectureExplorerDependencies.js";
import AuditExplorer from "../../audit-explorer/presentation/pages/AuditExplorer.js";
import { createAuditExplorerDependencies } from "../../audit-explorer/infrastructure/factory/createAuditExplorerDependencies.js";
import PlanExplorer from "../../plan-explorer/presentation/pages/PlanExplorer.js";
import { createPlanExplorerDependencies } from "../../plan-explorer/infrastructure/factory/createPlanExplorerDependencies.js";

import "./app.css";

const architectureDependencies = createArchitectureExplorerDependencies({
  graphUrl: "/graph.json",
  checkUrl: "/check.json",
});

const auditDependencies = createAuditExplorerDependencies({
  graphUrl: "/audit-graph.json",
});

const planDependencies = createPlanExplorerDependencies({
  planUrl: "/plan.json",
  taskUrl: "/plan/tasks",
});

type AppView = "architecture" | "audit" | "plan";

const TABS: Array<{ id: AppView; label: string }> = [
  { id: "architecture", label: "Arquitectura" },
  { id: "audit", label: "Auditoría" },
  { id: "plan", label: "Plan" },
];

export function App() {
  const [view, setView] = useState<AppView>("architecture");

  return (
    <div className="app-shell">
      <nav className="app-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`app-tab${view === tab.id ? " app-tab--active" : ""}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="app-view">
        {view === "architecture" && <ArchitectureExplorer dependencies={architectureDependencies} />}
        {view === "audit" && <AuditExplorer dependencies={auditDependencies} />}
        {view === "plan" && <PlanExplorer dependencies={planDependencies} />}
      </div>
    </div>
  );
}
