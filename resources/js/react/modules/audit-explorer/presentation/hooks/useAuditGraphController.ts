import { useCallback, useEffect, useState } from "react";

import { loadAuditGraph } from "../../application/use-cases/loadAuditGraph";
import type { AuditExplorerDependencies } from "../../infrastructure/factory/createAuditExplorerDependencies";
import type { AuditGraph, AuditGraphView, AuditHealth } from "../../domain/value-objects/AuditGraph";

export type AuditTarget = "laravel" | "react";

// Grafo de la vista y salud del proyecto, en paralelo (la salud no depende de la vista).
function loadViewWithHealth(
  dependencies: AuditExplorerDependencies,
  target: AuditTarget,
  view: AuditGraphView,
  focus: string | null,
  phpVersion: string | null,
) {
  return Promise.all([
    loadAuditGraph(dependencies.graphProvider, target, view, focus, phpVersion),
    dependencies.graphProvider.getHealth(target, phpVersion),
  ]);
}

type LoadedView = {
  graph: AuditGraph | null;
  health: AuditHealth | null;
  view: AuditGraphView;
  focus: string | null;
  phpVersion: string | null;
};

const INITIAL_VIEW: LoadedView = { graph: null, health: null, view: "overview", focus: null, phpVersion: null };

export function useAuditGraphController(dependencies: AuditExplorerDependencies, target: AuditTarget) {
  // Grafo, salud y la vista que los produjo cambian juntos: un solo estado.
  const [loaded, setLoaded] = useState<LoadedView>(INITIAL_VIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (view: AuditGraphView, focus: string | null, phpVersion: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const [graph, health] = await loadViewWithHealth(dependencies, target, view, focus, phpVersion);
        setLoaded({ graph, health, view, focus, phpVersion });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error inesperado");
        setLoaded((previous) => ({ ...previous, graph: null }));
      } finally {
        setLoading(false);
      }
    },
    [dependencies, target],
  );

  useEffect(() => {
    void load("overview", null, null);
    // Solo en el primer montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (nextView: AuditGraphView, nextFocus: string | null) => void load(nextView, nextFocus, loaded.phpVersion),
    [load, loaded.phpVersion],
  );

  // Cambiar la version objetivo de PHP recarga la vista actual incluyendo (o quitando)
  // la categoria php_compatibility. La primera vez con una version dispara el scan Docker.
  const setPhpVersion = useCallback(
    (nextPhpVersion: string | null) => void load(loaded.view, loaded.focus, nextPhpVersion),
    [load, loaded.view, loaded.focus],
  );

  return { ...loaded, loading, error, goTo, setPhpVersion };
}
