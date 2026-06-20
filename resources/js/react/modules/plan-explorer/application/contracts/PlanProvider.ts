import type { PlanGraph, PlanTaskState } from "../../domain/value-objects/PlanGraph";

export interface PlanProvider {
  getPlan(target?: "laravel" | "react"): Promise<PlanGraph>;
  setTaskState(taskKey: string, state: PlanTaskState, target?: "laravel" | "react"): Promise<PlanGraph>;
}
