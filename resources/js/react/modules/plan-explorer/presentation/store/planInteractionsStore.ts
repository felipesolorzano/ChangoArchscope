import { create } from "zustand";

import type { PlanTaskState } from "../../domain/value-objects/PlanGraph";

interface PlanInteractionsState {
  setTaskState: (taskKey: string, state: PlanTaskState) => void;
}

// Estado compartido entre el canvas/nodos y el controlador (regla del proyecto: no pasar el
// setter por props a traves de los nodos de React Flow). La pagina registra el handler real.
export const usePlanInteractionsStore = create<PlanInteractionsState>(() => ({
  setTaskState: () => {},
}));

export function registerPlanSetState(handler: (taskKey: string, state: PlanTaskState) => void): void {
  usePlanInteractionsStore.setState({ setTaskState: handler });
}
