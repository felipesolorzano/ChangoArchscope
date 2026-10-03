import type { PlanPhase } from "../../domain/value-objects/PlanGraph";
import { currentPhase } from "../constants/phaseView";
import { usePlanDrawerStore } from "../store/planDrawerStore";

// XRay X6: en que fase esta el proyecto (la primera que no pasa sus gates).
export function PhaseIndicator({ phases }: { phases: PlanPhase[] | undefined }) {
  const setDrawer = usePlanDrawerStore((state) => state.setDrawer);

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
    </div>
  );
}
