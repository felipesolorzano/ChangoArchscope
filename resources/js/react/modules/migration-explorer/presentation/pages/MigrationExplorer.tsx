import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft } from "lucide-react";

import type { BoundedContextMap } from "../../domain/value-objects/BoundedContextMap";
import type { MigrationExplorerDependencies } from "../../infrastructure/factory/createMigrationExplorerDependencies";
import { mapToFlow, type MigrationView } from "../../infrastructure/react-flow/mapToFlow";
import { MigrationCanvas } from "../components/MigrationCanvas";
import { useMigrationController } from "../hooks/useMigrationController";
import { registerMigrationInteractions } from "../store/migrationStore";

import "./migrationExplorer.css";

interface MigrationExplorerProps {
  dependencies: MigrationExplorerDependencies;
}

export function viewHint(view: MigrationView): string {
  return view === "module"
    ? " · usa el selector de cada archivo para moverlo de capa (se guarda)"
    : " · click en un módulo para ver sus capas y archivos";
}

export default function MigrationExplorer({ dependencies }: MigrationExplorerProps) {
  const { map, view, focus, loading, error, drillTo, back, moveFile, toggleValidated } = useMigrationController(dependencies);

  useEffect(() => {
    registerMigrationInteractions({ drill: drillTo, moveFile, toggleValidated });
  }, [drillTo, moveFile, toggleValidated]);

  const flow = useMemo(() => (map ? mapToFlow(map, view, focus) : { nodes: [], edges: [] }), [map, view, focus]);

  return (
    <main className="mig-explorer">
      <MigrationHeader map={map} view={view} focus={focus} onBack={back} />

      <MigrationCanvas
        key={`${view}:${focus ?? ""}`}
        loading={loading}
        error={error}
        empty={(map?.modules.length ?? 0) === 0}
        nodes={flow.nodes}
        edges={flow.edges}
        onInit={(instance) => instance.fitView({ padding: 0.2 })}
      />
    </main>
  );
}

interface MigrationHeaderProps {
  map: BoundedContextMap | null;
  view: MigrationView;
  focus: string | null;
  onBack: () => void;
}

function MigrationHeader({ map, view, focus, onBack }: MigrationHeaderProps) {
  const focusModule = map?.modules.find((module) => module.key === focus);
  const validated = map?.modules.filter((module) => module.validated).length ?? 0;

  return (
    <header className="mig-explorer__bar">
      <nav className="mig-breadcrumb">
        {view === "module" && (
          <button type="button" className="mig-breadcrumb__back" onClick={onBack}>
            <ArrowLeft size={14} /> Volver
          </button>
        )}
        <span className="mig-breadcrumb__crumb">
          {view === "module" ? `Módulo · ${focusModule?.name ?? focus}` : "Mapa de bounded contexts"}
        </span>
      </nav>
      {map && (
        <p className="mig-explorer__sub">
          {map.modules.length} módulos · <strong>{validated}</strong> validados
          {viewHint(view)}
        </p>
      )}
    </header>
  );
}
