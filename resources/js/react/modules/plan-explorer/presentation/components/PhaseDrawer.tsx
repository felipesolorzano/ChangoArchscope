import type { PlanGraph } from "../../domain/value-objects/PlanGraph";
import { usePlanDrawerStore } from "../store/planDrawerStore";
import { PhaseList } from "./PhaseList";

// XRay X6: fases y quality gates. No pide nada: las fases vienen en /plan.json.
export function PhaseDrawer({ graph }: { graph: PlanGraph | null }) {
  const open = usePlanDrawerStore((state) => state.drawer === "phases");
  const setDrawer = usePlanDrawerStore((state) => state.setDrawer);

  if (!open) {
    return null;
  }

  const phases = graph?.phases;

  return (
    <aside className="plan-drawer plan-characterization">
      <header className="plan-drawer__head">
        <div>
          <span className="plan-drawer__eyebrow">Plan por fases</span>
          <h2 className="plan-drawer__title">Fases y quality gates</h2>
        </div>
        <button type="button" className="plan-characterization__close" onClick={() => setDrawer(null)}>
          Cerrar
        </button>
      </header>

      {phases === undefined ? (
        <p className="plan-drawer__hint">Calculando fases…</p>
      ) : (
        <PhaseList phases={phases} taskTitles={Object.fromEntries(graph!.nodes.map((node) => [node.id, node.title]))} />
      )}
    </aside>
  );
}
