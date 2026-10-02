import { useMemo, useState } from "react";

import ArchitectureExplorer from "../../architecture-explorer/presentation/pages/ArchitectureExplorer.js";
import { createArchitectureExplorerDependencies } from "../../architecture-explorer/infrastructure/factory/createArchitectureExplorerDependencies.js";
import AuditExplorer from "../../audit-explorer/presentation/pages/AuditExplorer.js";
import { createAuditExplorerDependencies } from "../../audit-explorer/infrastructure/factory/createAuditExplorerDependencies.js";
import PlanExplorer from "../../plan-explorer/presentation/pages/PlanExplorer.js";
import { createPlanExplorerDependencies } from "../../plan-explorer/infrastructure/factory/createPlanExplorerDependencies.js";
import MigrationExplorer from "../../migration-explorer/presentation/pages/MigrationExplorer.js";
import { createMigrationExplorerDependencies } from "../../migration-explorer/infrastructure/factory/createMigrationExplorerDependencies.js";
import { mapTargetFor, type ProjectTarget } from "../domain/projectTarget.js";
import { useProjectTargetStore } from "./store/projectTargetStore.js";

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

type AppView = "architecture" | "audit" | "plan" | "migration" | "design";

const TABS: Array<{ id: AppView; label: string }> = [
  { id: "architecture", label: "Arquitectura" },
  { id: "audit", label: "Auditoría" },
  { id: "plan", label: "Plan" },
  { id: "migration", label: "Migración" },
  { id: "design", label: "Diseño" },
];

const TARGETS: Array<{ id: ProjectTarget; label: string }> = [
  { id: "laravel", label: "Laravel" },
  { id: "react", label: "React" },
];

export function App() {
  const [view, setView] = useState<AppView>("architecture");
  const target = useProjectTargetStore((state) => state.target);
  const setTarget = useProjectTargetStore((state) => state.setTarget);

  const migrationDependencies = useMemo(
    () => createMigrationExplorerDependencies({ mapUrl: "/bounded-context-map", target: mapTargetFor(target, "migration") }),
    [target],
  );
  const designDependencies = useMemo(
    () => createMigrationExplorerDependencies({ mapUrl: "/bounded-context-map", target: mapTargetFor(target, "design") }),
    [target],
  );

  return (
    <div className="app-shell">
      <nav className="app-tabs">
        <div className="app-target" role="group" aria-label="Stack analizado">
          {TARGETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`app-target__option${target === option.id ? " app-target__option--active" : ""}`}
              aria-pressed={target === option.id}
              onClick={() => setTarget(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
        {view === "architecture" && (
          <ArchitectureExplorer key={target} target={target} dependencies={architectureDependencies} />
        )}
        {view === "audit" && <AuditExplorer key={target} target={target} dependencies={auditDependencies} />}
        {view === "plan" && <PlanExplorer key={target} target={target} dependencies={planDependencies} />}
        {view === "migration" && <MigrationExplorer key={target} dependencies={migrationDependencies} />}
        {view === "design" && <MigrationExplorer key={target} dependencies={designDependencies} />}
      </div>
    </div>
  );
}
