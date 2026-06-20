import type { PlanProvider } from "../../application/contracts/PlanProvider";
import { HttpPlanProvider } from "../api/HttpPlanProvider";

export interface PlanExplorerDependencies {
  planProvider: PlanProvider;
}

export function createPlanExplorerDependencies({
  planUrl,
  taskUrl,
}: {
  planUrl: string;
  taskUrl: string;
}): PlanExplorerDependencies {
  return {
    planProvider: new HttpPlanProvider(planUrl, taskUrl),
  };
}
