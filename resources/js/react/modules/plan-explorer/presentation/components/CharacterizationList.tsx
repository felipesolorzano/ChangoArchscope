import type { CharacterizationPlan } from "../../domain/value-objects/Characterization";
import { downloadText } from "../../infrastructure/browser/downloadText";
import { skeletonLabel, targetKindLabel, targetReasons } from "../constants/characterizationView";

// XRay X4: objetivos de caracterizacion, del mas urgente al menos; cada esqueleto se descarga.
export function CharacterizationList({ plan }: { plan: CharacterizationPlan }) {
  if (plan.targets.length === 0) {
    return <p className="plan-drawer__hint">No hay objetivos: todo lo riesgoso ya tiene evidencia de test</p>;
  }

  return (
    <ol className="plan-drawer__list">
      {plan.targets.map((target) => (
        <li key={target.file} className="plan-characterization__item">
          <div className="plan-characterization__head">
            <span className="plan-characterization__score" title="riesgo × uso">
              {target.score}
            </span>
            <span className="plan-characterization__kind">{targetKindLabel(target.kind)}</span>
            <span className="plan-drawer__file" title={target.file}>
              {target.file}
            </span>
          </div>
          <span className="plan-drawer__msg">{targetReasons(target).join(" · ")}</span>
          <div className="plan-characterization__skeletons">
            {target.skeletons.map((skeleton) => (
              <button
                key={skeleton.path}
                type="button"
                className="plan-characterization__download"
                title={skeleton.path}
                onClick={() => downloadText(skeleton.path, skeleton.content)}
              >
                {skeletonLabel(skeleton.kind)}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
