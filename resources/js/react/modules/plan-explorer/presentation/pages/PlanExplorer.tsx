import { useEffect, useMemo } from "react";
import "@xyflow/react/dist/style.css";

import type { PlanGraph } from "../../domain/value-objects/PlanGraph";
import type { ProtectionBaseline } from "../../domain/value-objects/Protection";
import type { PlanExplorerDependencies } from "../../infrastructure/factory/createPlanExplorerDependencies";
import { toPlanFlowEdges, toPlanFlowNodes, toPlanLaneNodes } from "../../infrastructure/react-flow/planFlowAdapter";
import { CharacterizationDrawer } from "../components/CharacterizationDrawer";
import { CodemodDrawer } from "../components/CodemodDrawer";
import { PlanCanvas } from "../components/PlanCanvas";
import { PhaseDrawer } from "../components/PhaseDrawer";
import { PhaseIndicator } from "../components/PhaseIndicator";
import { PlanFindingsDrawer } from "../components/PlanFindingsDrawer";
import { ProtectionStrip } from "../components/ProtectionStrip";
import { PLAN_STATE_OPTIONS, stateColor, stateLabel } from "../constants/planView";
import { usePlanController } from "../hooks/usePlanController";
import { registerPlanInteractions } from "../store/planInteractionsStore";

import "./planExplorer.css";

interface PlanExplorerProps {
  dependencies: PlanExplorerDependencies;
  target: "laravel" | "react";
}

export default function PlanExplorer({ dependencies, target }: PlanExplorerProps) {
  const { graph, loading, error, setTaskState, focusedTaskKey, taskFindings, findingsLoading, openTask, closeTask, protection } =
    usePlanController(dependencies, target);

  useEffect(() => {
    registerPlanInteractions({ setTaskState, openTask });
  }, [setTaskState, openTask]);

  const flowNodes = useMemo(() => [...toPlanLaneNodes(graph?.lanes ?? []), ...toPlanFlowNodes(graph?.nodes ?? [])], [graph]);
  const flowEdges = useMemo(() => toPlanFlowEdges(graph?.edges ?? []), [graph]);

  const total = graph?.summary.tasks ?? 0;

  return (
    <main className="plan-explorer">
      <PlanHeader graph={graph} protection={protection} />

      <PlanCanvas
        loading={loading}
        error={error}
        empty={total === 0}
        checks={graph?.checks}
        nodes={flowNodes}
        edges={flowEdges}
        onInit={(instance) => instance.fitView({ padding: 0.2 })}
      />

      <PlanFindingsDrawer
        graph={graph}
        focusedTaskKey={focusedTaskKey}
        findings={taskFindings}
        loading={findingsLoading}
        onClose={closeTask}
      />

      <CharacterizationDrawer provider={dependencies.planProvider} target={target} />
      <CodemodDrawer provider={dependencies.planProvider} target={target} />
      <PhaseDrawer graph={graph} />
    </main>
  );
}

function PlanHeader({ graph, protection }: { graph: PlanGraph | null; protection: ProtectionBaseline | null }) {
  return (
    <header className="plan-explorer__bar">
      <div>
        <h1 className="plan-explorer__title">Plan de remediacion</h1>
        <p className="plan-explorer__sub">
          {graph?.summary.tasks ?? 0} tareas derivadas de la auditoria · click en un estado para marcar avance (se guarda)
        </p>
        <ProtectionStrip protection={protection} />
        <PhaseIndicator phases={graph?.phases} />
      </div>
      <PlanProgress byState={graph?.summary.by_state ?? {}} />
    </header>
  );
}

function PlanProgress({ byState }: { byState: Record<string, number> }) {
  return (
    <div className="plan-progress">
      {PLAN_STATE_OPTIONS.map((option) => (
        <span key={option.state} className="plan-progress__item">
          <span className="plan-progress__dot" style={{ background: stateColor(option.state) }} />
          {stateLabel(option.state)}: <strong>{byState[option.state] ?? 0}</strong>
        </span>
      ))}
    </div>
  );
}
