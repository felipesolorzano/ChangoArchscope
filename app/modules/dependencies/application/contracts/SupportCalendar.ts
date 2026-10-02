import type { SupportCycle } from "../../domain/value-objects/Security.js";

/** Calendario de soporte (endoflife.date); null = producto desconocido; lanza si la consulta falla. */
export type SupportCalendar = {
  fetch(product: string): Promise<SupportCycle[] | null>;
};
