import { useCallback, useEffect, useRef, useState } from "react";

import type { DependenciesProvider } from "../../application/contracts/DependenciesProvider";
import type { DependencyReport } from "../../domain/value-objects/DependencyReport";
import { useDependenciesExplorerStore } from "../store/dependenciesExplorerStore";

type Target = "laravel" | "react";

// Reporte del stack: carga al montar y al cambiar el runtime elegido; refresh() vuelve a detectar y
// consultar los registros. Una respuesta vieja (de un runtime anterior) se descarta.
export function useDependenciesReport(provider: DependenciesProvider, target: Target) {
  const runtimes = useDependenciesExplorerStore((state) => state.runtimes);
  const [report, setReport] = useState<DependencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(
    async (refresh: boolean) => {
      const request = ++latestRequest.current;
      setLoading(true);
      setError(null);

      try {
        const next = await provider.getReport(target, runtimes, refresh);
        if (request === latestRequest.current) {
          setReport(next);
        }
      } catch (caught) {
        if (request === latestRequest.current) {
          setError(caught instanceof Error ? caught.message : "Error inesperado");
        }
      } finally {
        if (request === latestRequest.current) {
          setLoading(false);
        }
      }
    },
    [provider, target, runtimes],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return { report, loading, error, refresh: () => load(true) };
}
