import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";

export interface PlanProvider {
  getPlan(target?: "laravel" | "react"): Promise<PlanGraph>;
  setTaskState(taskKey: string, state: PlanTaskState, target?: "laravel" | "react"): Promise<PlanGraph>;
  getTaskFindings(taskKey: string, target?: "laravel" | "react"): Promise<PlanTaskFindings>;
}
