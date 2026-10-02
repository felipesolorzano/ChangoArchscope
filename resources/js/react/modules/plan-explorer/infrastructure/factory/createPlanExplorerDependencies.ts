import type { PlanProvider } from "../../application/contracts/PlanProvider";
import { HttpPlanProvider } from "../api/HttpPlanProvider";

export interface PlanExplorerDependencies {
  planProvider: PlanProvider;
}

export function createPlanExplorerDependencies({
  planUrl,
  taskUrl,
  protectionUrl,
}: {
  planUrl: string;
  taskUrl: string;
  protectionUrl: string;
}): PlanExplorerDependencies {
  return {
    planProvider: new HttpPlanProvider(planUrl, taskUrl, protectionUrl),
  };
}
