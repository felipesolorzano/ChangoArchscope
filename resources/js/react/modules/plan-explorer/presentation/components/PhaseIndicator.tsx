import type { PlanGraphNode, PlanPhase } from "../../domain/value-objects/PlanGraph";
import { currentPhase } from "../constants/phaseView";
import { usePlanDrawerStore } from "../store/planDrawerStore";
import { usePlanInteractionsStore } from "../store/planInteractionsStore";

// XRay X6: en que fase esta el proyecto (la primera que no pasa sus gates) y cual es el siguiente paso.
export function PhaseIndicator({ phases, next = null }: { phases: PlanPhase[] | undefined; next?: PlanGraphNode | null }) {
  const setDrawer = usePlanDrawerStore((state) => state.setDrawer);
  const openTask = usePlanInteractionsStore((state) => state.openTask);

  if (phases === undefined || phases.length === 0) {
    return null;
  }

  const current = currentPhase(phases);

  return (
    <div className="plan-protection">
      <span className="plan-phases__current">{current === null ? "Todas las fases cumplidas" : `Fase ${current.number} · ${current.title}`}</span>
      <button type="button" className="plan-protection__action" onClick={() => setDrawer("phases")}>
        Fases
      </button>
      {next !== null && (
        <button type="button" className="plan-phases__next" onClick={() => openTask(next.id)}>
          {`Siguiente: ${next.title}`}
        </button>
      )}
    </div>
  );
}
