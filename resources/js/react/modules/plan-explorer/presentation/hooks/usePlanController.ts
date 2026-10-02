import { useCallback, useEffect, useState } from "react";

import type { PlanExplorerDependencies } from "../../infrastructure/factory/createPlanExplorerDependencies";
import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";
import type { ProtectionBaseline } from "../../domain/value-objects/Protection";

type PlanTarget = "laravel" | "react";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Error inesperado";
}

// Grafo del plan: carga inicial, recarga y cambio de estado de una tarea.
function usePlanGraph(dependencies: PlanExplorerDependencies, target: PlanTarget) {
  const [graph, setGraph] = useState<PlanGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setGraph(await dependencies.planProvider.getPlan(target));
    } catch (caught) {
      setError(errorMessage(caught));
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
        setError(errorMessage(caught));
      }
    },
    [dependencies.planProvider, target],
  );

  return { graph, loading, error, reload, setTaskState };
}

// Tarea enfocada en el panel lateral y sus hallazgos concretos.
function useTaskFindings(dependencies: PlanExplorerDependencies, target: PlanTarget) {
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

  return { focusedTaskKey, taskFindings, findingsLoading, openTask, closeTask };
}

// Red de seguridad del stack (XRay X3); null mientras carga o si falla (no rompe el plan).
function useProtection(dependencies: PlanExplorerDependencies, target: PlanTarget) {
  const [protection, setProtection] = useState<ProtectionBaseline | null>(null);

  useEffect(() => {
    let active = true;
    dependencies.planProvider
      .getProtection(target)
      .then((baseline) => active && setProtection(baseline))
      .catch(() => active && setProtection(null));
    return () => {
      active = false;
    };
  }, [dependencies.planProvider, target]);

  return { protection };
}

export function usePlanController(dependencies: PlanExplorerDependencies, target: PlanTarget) {
  return { ...usePlanGraph(dependencies, target), ...useTaskFindings(dependencies, target), ...useProtection(dependencies, target) };
}
