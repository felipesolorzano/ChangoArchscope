import type { NodeProps } from "@xyflow/react";

import type { PlanLane } from "../../domain/value-objects/PlanGraph";
import { phaseStatusColor, phaseStatusLabel } from "../constants/phaseView";

// XRay X6: encabezado de la columna de una fase en el grafo del plan.
export function PlanLaneHeader({ data }: NodeProps) {
  const lane = data as unknown as PlanLane;

  return (
    <div className={lane.current ? "plan-lane plan-lane--current" : "plan-lane"}>
      <span className="plan-lane__phase">{`Fase ${lane.phase}`}</span>
      <span className="plan-lane__title">{lane.title}</span>
      <span className="plan-lane__status" style={{ color: phaseStatusColor(lane.status) }}>
        {phaseStatusLabel(lane.status)}
      </span>
    </div>
  );
}
