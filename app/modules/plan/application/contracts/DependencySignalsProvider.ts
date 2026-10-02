import type { DependencySignals } from "../../domain/value-objects/Plan.js";

/** Trabajo de actualizacion de paquetes del target (modulo dependencies, sin red). */
export type DependencySignalsProvider = {
  getSignals(target: "laravel" | "react"): Promise<DependencySignals>;
};
