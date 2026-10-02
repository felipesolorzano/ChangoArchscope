import { useState } from "react";

import type { DependenciesExplorerDependencies } from "../../infrastructure/factory/createDependenciesExplorerDependencies";
import { DependencyDrawer } from "../components/DependencyDrawer";
import { DependencyFilters } from "../components/DependencyFilters";
import { DependencyList } from "../components/DependencyList";
import { DependencySummary } from "../components/DependencySummary";
import { RuntimeSelector } from "../components/RuntimeSelector";
import { useDependenciesReport } from "../hooks/useDependenciesReport";
import { initialDependenciesExplorerState, useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";

import "./dependenciesExplorer.css";

interface DependenciesExplorerProps {
  dependencies: DependenciesExplorerDependencies;
  target: "laravel" | "react";
}

export default function DependenciesExplorer({ dependencies, target }: DependenciesExplorerProps) {
  // Cada montaje (pestaña o stack nuevo) empieza sin runtime elegido ni filtros.
  useState(() => useDependenciesExplorerStore.setState(initialDependenciesExplorerState()));
  const { report, loading, error, refresh } = useDependenciesReport(dependencies.dependenciesProvider, target);
  const now = new Date();

  return (
    <main className="deps-explorer">
      <header className="deps-explorer__bar">
        <div>
          <h1 className="deps-explorer__title">Dependencias</h1>
          {report && (
            <p className="deps-explorer__sub">
              {report.summary.total} paquetes en {report.manifests.length} manifiestos
            </p>
          )}
        </div>
        <div className="deps-explorer__actions">
          <button type="button" className="deps-refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? "Consultando…" : "Refrescar"}
          </button>
        </div>
      </header>

      {error && <p className="deps-state deps-state--error">{error}</p>}
      {!report && loading && <p className="deps-state">Consultando registros… (la primera vez puede tardar unos segundos)</p>}

      {report && (
        <div className="deps-explorer__body">
          <RuntimeSelector runtimes={report.runtimes} />
          <DependencySummary summary={report.summary} />
          <DependencyFilters />
          <DependencyList dependencies={report.dependencies} now={now} />
          <DependencyDrawer report={report} now={now} />
        </div>
      )}
    </main>
  );
}
