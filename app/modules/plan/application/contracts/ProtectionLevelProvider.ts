import type { PlanProtectionLevel } from "../../domain/value-objects/Plan.js";

/** Nivel de proteccion del stack (modulo protection, XRay X3) para el gate de la fase 3. */
export type ProtectionLevelProvider = {
  getLevel(target: "laravel" | "react"): Promise<PlanProtectionLevel>;
};
