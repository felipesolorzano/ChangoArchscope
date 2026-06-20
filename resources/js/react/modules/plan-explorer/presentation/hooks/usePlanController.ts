import { useCallback, useEffect, useState } from "react";

import type { PlanExplorerDependencies } from "../../infrastructure/factory/createPlanExplorerDependencies";
import type { PlanGraph, PlanTaskState } from "../../domain/value-objects/PlanGraph";

export function usePlanController(dependencies: PlanExplorerDependencies) {
  const [graph, setGraph] = useState<PlanGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setGraph(await dependencies.planProvider.getPlan("laravel"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }, [dependencies.planProvider]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setTaskState = useCallback(
    async (taskKey: string, state: PlanTaskState) => {
      try {
        setGraph(await dependencies.planProvider.setTaskState(taskKey, state, "laravel"));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error inesperado");
      }
    },
    [dependencies.planProvider],
  );

  return { graph, loading, error, reload, setTaskState };
}
