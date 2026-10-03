import type { PlanGate, PlanPhase } from "../../domain/value-objects/PlanGraph";
import { gateTarget, gateValue, phaseHeading, phaseStatusColor, phaseStatusLabel } from "../constants/phaseView";

const GATE_MARKS: Record<PlanGate["status"], string> = { passed: "✓", failed: "✗", unknown: "?" };

// XRay X6: fases 0–10 con sus quality gates y las tareas que los mueven.
export function PhaseList({ phases, taskTitles }: { phases: PlanPhase[]; taskTitles: Record<string, string> }) {
  return (
    <ol className="plan-drawer__list">
      {phases.map((phase) => (
        <li key={phase.key} className={phase.current ? "plan-phases__item plan-phases__item--current" : "plan-phases__item"}>
          <div className="plan-characterization__head">
            <span className="plan-codemods__title">{phaseHeading(phase)}</span>
            <span className="plan-characterization__kind" style={{ color: phaseStatusColor(phase.status) }}>
              {phaseStatusLabel(phase.status)}
            </span>
          </div>
          <span className="plan-codemods__note">{phase.goal}</span>
          {phase.gates.map((gate) => (
            <span key={gate.key} className={`plan-phases__gate plan-phases__gate--${gate.status}`}>
              {`${GATE_MARKS[gate.status]} ${gate.label}: ${gateValue(gate)} (meta ${gateTarget(gate)})`}
            </span>
          ))}
          {phase.tasks.length > 0 && <span className="plan-drawer__msg">{`Tareas: ${phase.tasks.map((task) => taskTitles[task] ?? task).join(" · ")}`}</span>}
        </li>
      ))}
    </ol>
  );
}
