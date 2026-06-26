import { useCallback, useEffect, useState } from "react";

import { loadAuditGraph } from "../../application/use-cases/loadAuditGraph";
import type { AuditExplorerDependencies } from "../../infrastructure/factory/createAuditExplorerDependencies";
import type { AuditGraph, AuditGraphView } from "../../domain/value-objects/AuditGraph";

export type AuditTarget = "laravel" | "react";

export function useAuditGraphController(dependencies: AuditExplorerDependencies) {
  const [graph, setGraph] = useState<AuditGraph | null>(null);
  const [view, setView] = useState<AuditGraphView>("overview");
  const [focus, setFocus] = useState<string | null>(null);
  const [phpVersion, setPhpVersionState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextView: AuditGraphView, nextFocus: string | null, nextPhpVersion: string | null) => {
      setLoading(true);
      setError(null);

      try {
        setGraph(await loadAuditGraph(dependencies.graphProvider, "laravel", nextView, nextFocus, nextPhpVersion));
        setView(nextView);
        setFocus(nextFocus);
        setPhpVersionState(nextPhpVersion);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error inesperado");
        setGraph(null);
      } finally {
        setLoading(false);
      }
    },
    [dependencies.graphProvider],
  );

  useEffect(() => {
    void load("overview", null, null);
    // Solo en el primer montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback(
    (nextView: AuditGraphView, nextFocus: string | null) => void load(nextView, nextFocus, phpVersion),
    [load, phpVersion],
  );

  // Cambiar la version objetivo de PHP recarga la vista actual incluyendo (o quitando)
  // la categoria php_compatibility. La primera vez con una version dispara el scan Docker.
  const setPhpVersion = useCallback(
    (nextPhpVersion: string | null) => void load(view, focus, nextPhpVersion),
    [load, view, focus],
  );

  return { graph, view, focus, phpVersion, loading, error, goTo, setPhpVersion };
}
