import type { PlanProvider } from "../../application/contracts/PlanProvider";
import type { CharacterizationPlan } from "../../domain/value-objects/Characterization";
import type { CodemodPlan } from "../../domain/value-objects/Codemod";
import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";
import type { ProtectionBaseline } from "../../domain/value-objects/Protection";

async function readJson<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }

  return response.json();
}

export class HttpPlanProvider implements PlanProvider {
  constructor(
    private readonly planUrl: string,
    private readonly taskUrl: string,
    private readonly protectionUrl: string,
    private readonly characterizationUrl: string,
    private readonly codemodsUrl: string,
  ) {}

  async getCodemods(target: "laravel" | "react" = "laravel"): Promise<CodemodPlan> {
    const url = new URL(this.codemodsUrl, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    return readJson<CodemodPlan>(response, "No se pudieron calcular los candidatos a codemod");
  }

  async getCharacterization(target: "laravel" | "react" = "laravel"): Promise<CharacterizationPlan> {
    const url = new URL(this.characterizationUrl, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    return readJson<CharacterizationPlan>(response, "No se pudieron calcular los objetivos de caracterizacion");
  }

  async getProtection(target: "laravel" | "react" = "laravel"): Promise<ProtectionBaseline> {
    const url = new URL(this.protectionUrl, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    return readJson<ProtectionBaseline>(response, "No se pudo cargar la proteccion");
  }

  async getPlan(target: "laravel" | "react" = "laravel"): Promise<PlanGraph> {
    const url = new URL(this.planUrl, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    return readJson<PlanGraph>(response, "No se pudo cargar el plan");
  }

  async setTaskState(taskKey: string, state: PlanTaskState, target: "laravel" | "react" = "laravel"): Promise<PlanGraph> {
    const url = new URL(`${this.taskUrl}/${encodeURIComponent(taskKey)}`, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ state }),
    });

    return readJson<PlanGraph>(response, "No se pudo actualizar la tarea");
  }

  async getTaskFindings(taskKey: string, target: "laravel" | "react" = "laravel"): Promise<PlanTaskFindings> {
    const url = new URL(`${this.taskUrl}/${encodeURIComponent(taskKey)}/findings`, window.location.origin);
    url.searchParams.set("target", target);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });

    return readJson<PlanTaskFindings>(response, "No se pudieron cargar los hallazgos");
  }
}
