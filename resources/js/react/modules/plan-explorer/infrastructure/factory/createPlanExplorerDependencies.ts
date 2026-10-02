import type { PlanProvider } from "../../application/contracts/PlanProvider";
import { HttpPlanProvider } from "../api/HttpPlanProvider";

export interface PlanExplorerDependencies {
  planProvider: PlanProvider;
}

export function createPlanExplorerDependencies({
  planUrl,
  taskUrl,
  protectionUrl,
  characterizationUrl,
}: {
  planUrl: string;
  taskUrl: string;
  protectionUrl: string;
  characterizationUrl: string;
}): PlanExplorerDependencies {
  return {
    planProvider: new HttpPlanProvider(planUrl, taskUrl, protectionUrl, characterizationUrl),
  };
}
