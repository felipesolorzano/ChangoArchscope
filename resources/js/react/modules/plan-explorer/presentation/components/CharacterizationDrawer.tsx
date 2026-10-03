import { useEffect, useState } from "react";

import type { PlanProvider } from "../../application/contracts/PlanProvider";
import type { CharacterizationPlan } from "../../domain/value-objects/Characterization";
import { usePlanDrawerStore } from "../store/planDrawerStore";
import { CharacterizationList } from "./CharacterizationList";

interface CharacterizationDrawerProps {
  provider: PlanProvider;
  target: "laravel" | "react";
}

// XRay X4: "Que proteger primero". Solo existe abierto; cada apertura vuelve a pedir el plan.
export function CharacterizationDrawer(props: CharacterizationDrawerProps) {
  const open = usePlanDrawerStore((state) => state.drawer === "characterization");

  return open ? <CharacterizationPanel {...props} /> : null;
}

function CharacterizationPanel({ provider, target }: CharacterizationDrawerProps) {
  const setDrawer = usePlanDrawerStore((state) => state.setDrawer);
  const [plan, setPlan] = useState<CharacterizationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    provider
      .getCharacterization(target)
      .then((result) => active && setPlan(result))
      .catch((reason: Error) => active && setError(reason.message));

    return () => {
      active = false;
    };
  }, [provider, target]);

  return (
    <aside className="plan-drawer plan-characterization">
      <header className="plan-drawer__head">
        <div>
          <span className="plan-drawer__eyebrow">Tests de caracterizacion</span>
          <h2 className="plan-drawer__title">Que proteger primero</h2>
        </div>
        <button type="button" className="plan-characterization__close" onClick={() => setDrawer(null)}>
          Cerrar
        </button>
      </header>

      {error !== null ? (
        <p className="plan-drawer__hint">{error}</p>
      ) : plan === null ? (
        <p className="plan-drawer__hint">Calculando objetivos…</p>
      ) : (
        <CharacterizationList plan={plan} />
      )}
    </aside>
  );
}
