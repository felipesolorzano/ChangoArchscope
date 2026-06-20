import type { PlanProvider } from "../../application/contracts/PlanProvider";
import type { PlanGraph, PlanTaskFindings, PlanTaskState } from "../../domain/value-objects/PlanGraph";

async function readJson<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }

  return response.json();
}

export class HttpPlanProvider implements PlanProvider {
  constructor(private readonly planUrl: string, private readonly taskUrl: string) {}

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
