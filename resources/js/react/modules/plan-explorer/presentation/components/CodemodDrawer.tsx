import { useEffect, useState } from "react";

import type { PlanProvider } from "../../application/contracts/PlanProvider";
import type { CodemodPlan } from "../../domain/value-objects/Codemod";
import { usePlanDrawerStore } from "../store/planDrawerStore";
import { CodemodList } from "./CodemodList";

interface CodemodDrawerProps {
  provider: PlanProvider;
  target: "laravel" | "react";
}

// XRay X5: candidatos a codemod. Solo existe abierto; cada apertura vuelve a pedir el plan.
export function CodemodDrawer(props: CodemodDrawerProps) {
  const open = usePlanDrawerStore((state) => state.drawer === "codemods");

  return open ? <CodemodPanel {...props} /> : null;
}

function CodemodPanel({ provider, target }: CodemodDrawerProps) {
  const setDrawer = usePlanDrawerStore((state) => state.setDrawer);
  const [plan, setPlan] = useState<CodemodPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    provider
      .getCodemods(target)
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
          <span className="plan-drawer__eyebrow">APIs legacy</span>
          <h2 className="plan-drawer__title">Candidatos a codemod</h2>
        </div>
        <button type="button" className="plan-characterization__close" onClick={() => setDrawer(null)}>
          Cerrar
        </button>
      </header>

      {error !== null ? (
        <p className="plan-drawer__hint">{error}</p>
      ) : plan === null ? (
        <p className="plan-drawer__hint">Buscando APIs legacy…</p>
      ) : (
        <CodemodList plan={plan} />
      )}
    </aside>
  );
}
