import { create } from "zustand";

export type PlanDrawer = "characterization" | "codemods" | "phases";

interface PlanDrawerState {
  drawer: PlanDrawer | null;
  setDrawer: (drawer: PlanDrawer | null) => void;
}

// XRay X4/X5/X6: los botones de la franja de proteccion abren un panel; uno solo a la vez.
export const usePlanDrawerStore = create<PlanDrawerState>((set, get, api) => {
  // El render estatico (tests) lee el snapshot de servidor: que sea el estado actual.
  Object.assign(api, { getServerState: get });

  return {
    drawer: null,
    setDrawer: (drawer) => set({ drawer }),
  };
});
