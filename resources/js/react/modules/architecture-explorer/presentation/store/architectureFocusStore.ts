import { create } from "zustand";

interface ArchitectureFocusState {
  focusedNodeId: string | null;
  setFocusedNodeId: (nodeId: string | null) => void;
}

// Nodo enfocado del explorador: lo cambian el lienzo, el sidebar y el panel de salud.
export const useArchitectureFocusStore = create<ArchitectureFocusState>((set, get, api) => {
  // La app no se renderiza en servidor: el snapshot "de servidor" de zustand (el que usa
  // renderToStaticMarkup en los tests de componentes) debe ser el estado actual, no el inicial.
  Object.assign(api, { getServerState: get });

  return {
    focusedNodeId: null,
    setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
  };
});
