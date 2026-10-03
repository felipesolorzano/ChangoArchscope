import { create } from "zustand";

interface PlanViewState {
  showDependencies: boolean;
  toggleDependencies: () => void;
}

// XRay X6: el grafo muestra el orden del flujo ("termina → sigue") o, a pedido, las dependencias reales.
export const usePlanViewStore = create<PlanViewState>((set, get, api) => {
  // El render estatico (tests) lee el snapshot de servidor: que sea el estado actual.
  Object.assign(api, { getServerState: get });

  return {
    showDependencies: false,
    toggleDependencies: () => set({ showDependencies: !get().showDependencies }),
  };
});
