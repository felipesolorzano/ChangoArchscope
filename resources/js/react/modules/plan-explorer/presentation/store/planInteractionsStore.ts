import { create } from "zustand";

import type { PlanTaskState } from "../../domain/value-objects/PlanGraph";

interface PlanInteractionsState {
  setTaskState: (taskKey: string, state: PlanTaskState) => void;
  openTask: (taskKey: string) => void;
}

// Estado compartido entre el canvas/nodos y el controlador (regla del proyecto: no pasar los
// setters por props a traves de los nodos de React Flow). La pagina registra los handlers reales.
export const usePlanInteractionsStore = create<PlanInteractionsState>(() => ({
  setTaskState: () => {},
  openTask: () => {},
}));

export function registerPlanInteractions(handlers: Partial<PlanInteractionsState>): void {
  usePlanInteractionsStore.setState(handlers);
}
