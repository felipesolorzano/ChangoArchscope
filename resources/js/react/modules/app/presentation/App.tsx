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
  healthUrl: "/audit-health.json",
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

  return (
    <div className="app-shell">
      <nav className="app-tabs">
        <TargetSwitch target={target} onChange={setTarget} />
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={`app-tab${view === tab.id ? " app-tab--active" : ""}`} onClick={() => setView(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="app-view">
        <ActiveView view={view} target={target} />
      </div>
    </div>
  );
}

function TargetSwitch({ target, onChange }: { target: ProjectTarget; onChange: (target: ProjectTarget) => void }) {
  return (
    <div className="app-target" role="group" aria-label="Stack analizado">
      {TARGETS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`app-target__option${target === option.id ? " app-target__option--active" : ""}`}
          aria-pressed={target === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Clave de montaje de la vista: cambiar de pestaña o de stack reinicia su estado. Migracion y Diseño
// usan el mismo componente, asi que la vista tiene que ser parte de la clave.
export function viewKey(view: AppView, target: ProjectTarget): string {
  return `${view}:${target}`;
}

// La vista activa.
function ActiveView({ view, target }: { view: AppView; target: ProjectTarget }) {
  const key = viewKey(view, target);
  const mapDependencies = useMemo(
    () => ({
      migration: createMigrationExplorerDependencies({ mapUrl: "/bounded-context-map", target: mapTargetFor(target, "migration") }),
      design: createMigrationExplorerDependencies({ mapUrl: "/bounded-context-map", target: mapTargetFor(target, "design") }),
    }),
    [target],
  );

  switch (view) {
    case "architecture":
      return <ArchitectureExplorer key={key} target={target} dependencies={architectureDependencies} />;
    case "audit":
      return <AuditExplorer key={key} target={target} dependencies={auditDependencies} />;
    case "plan":
      return <PlanExplorer key={key} target={target} dependencies={planDependencies} />;
    default:
      return <MigrationExplorer key={key} dependencies={mapDependencies[view]} />;
  }
}
