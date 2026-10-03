import type { CharacterizationPlan } from "../../domain/value-objects/Characterization";
import type { CodemodPlan } from "../../domain/value-objects/Codemod";
import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";
import type { ProtectionBaseline } from "../../domain/value-objects/Protection";

export interface PlanProvider {
  getPlan(target?: "laravel" | "react"): Promise<PlanGraph>;
  setTaskState(taskKey: string, state: PlanTaskState, target?: "laravel" | "react"): Promise<PlanGraph>;
  getTaskFindings(taskKey: string, target?: "laravel" | "react"): Promise<PlanTaskFindings>;
  getProtection(target?: "laravel" | "react"): Promise<ProtectionBaseline>;
  getCharacterization(target?: "laravel" | "react"): Promise<CharacterizationPlan>;
  getCodemods(target?: "laravel" | "react"): Promise<CodemodPlan>;
}
