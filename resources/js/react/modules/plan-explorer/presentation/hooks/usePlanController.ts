import { useCallback, useEffect, useState } from "react";

import type { PlanExplorerDependencies } from "../../infrastructure/factory/createPlanExplorerDependencies";
import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";

export function usePlanController(dependencies: PlanExplorerDependencies, target: "laravel" | "react") {
  const [graph, setGraph] = useState<PlanGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setGraph(await dependencies.planProvider.getPlan(target));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }, [dependencies.planProvider, target]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setTaskState = useCallback(
    async (taskKey: string, state: PlanTaskState) => {
      try {
        setGraph(await dependencies.planProvider.setTaskState(taskKey, state, target));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error inesperado");
      }
    },
    [dependencies.planProvider, target],
  );

  const [focusedTaskKey, setFocusedTaskKey] = useState<string | null>(null);
  const [taskFindings, setTaskFindings] = useState<PlanTaskFindings | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);

  const openTask = useCallback(
    async (taskKey: string) => {
      setFocusedTaskKey(taskKey);
      setTaskFindings(null);
      setFindingsLoading(true);

      try {
        setTaskFindings(await dependencies.planProvider.getTaskFindings(taskKey, target));
      } catch {
        setTaskFindings({ taskKey, total: 0, items: [] });
      } finally {
        setFindingsLoading(false);
      }
    },
    [dependencies.planProvider, target],
  );

  const closeTask = useCallback(() => setFocusedTaskKey(null), []);

  return { graph, loading, error, reload, setTaskState, focusedTaskKey, taskFindings, findingsLoading, openTask, closeTask };
}
