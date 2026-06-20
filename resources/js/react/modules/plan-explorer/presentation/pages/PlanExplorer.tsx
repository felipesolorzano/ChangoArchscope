import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";

import type { PlanExplorerDependencies } from "../../infrastructure/factory/createPlanExplorerDependencies";
import { toPlanFlowEdges, toPlanFlowNodes } from "../../infrastructure/react-flow/planFlowAdapter";
import { PlanCanvas } from "../components/PlanCanvas";
import { PLAN_STATE_OPTIONS, stateColor, stateLabel } from "../constants/planView";
import { usePlanController } from "../hooks/usePlanController";
import { registerPlanSetState } from "../store/planInteractionsStore";

import "./planExplorer.css";

interface PlanExplorerProps {
  dependencies: PlanExplorerDependencies;
}

export default function PlanExplorer({ dependencies }: PlanExplorerProps) {
  const { graph, loading, error, setTaskState } = usePlanController(dependencies);

  useEffect(() => {
    registerPlanSetState(setTaskState);
  }, [setTaskState]);

  const flowNodes = useMemo(() => toPlanFlowNodes(graph?.nodes ?? []), [graph]);
  const flowEdges = useMemo(() => toPlanFlowEdges(graph?.edges ?? []), [graph]);

  const byState = graph?.summary.by_state ?? {};
  const total = graph?.summary.tasks ?? 0;

  return (
    <main className="plan-explorer">
      <header className="plan-explorer__bar">
        <div>
          <h1 className="plan-explorer__title">Plan de remediacion</h1>
          <p className="plan-explorer__sub">
            {total} tareas derivadas de la auditoria · click en un estado para marcar avance (se guarda)
          </p>
        </div>
        <div className="plan-progress">
          {PLAN_STATE_OPTIONS.map((option) => (
            <span key={option.state} className="plan-progress__item">
              <span className="plan-progress__dot" style={{ background: stateColor(option.state) }} />
              {stateLabel(option.state)}: <strong>{byState[option.state] ?? 0}</strong>
            </span>
          ))}
        </div>
      </header>

      <PlanCanvas
        loading={loading}
        error={error}
        empty={total === 0}
        nodes={flowNodes}
        edges={flowEdges}
        onInit={(instance) => instance.fitView({ padding: 0.2 })}
      />
    </main>
  );
}
