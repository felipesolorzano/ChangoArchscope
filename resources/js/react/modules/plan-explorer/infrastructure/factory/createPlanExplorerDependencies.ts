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
  codemodsUrl,
}: {
  planUrl: string;
  taskUrl: string;
  protectionUrl: string;
  characterizationUrl: string;
  codemodsUrl: string;
}): PlanExplorerDependencies {
  return {
    planProvider: new HttpPlanProvider(planUrl, taskUrl, protectionUrl, characterizationUrl, codemodsUrl),
  };
}
