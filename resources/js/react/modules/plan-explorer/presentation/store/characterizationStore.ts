import { create } from "zustand";

interface CharacterizationState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

// XRay X4: el boton de la franja de proteccion abre el panel "Que proteger primero".
export const useCharacterizationStore = create<CharacterizationState>((set, get, api) => {
  // El render estatico (tests) lee el snapshot de servidor: que sea el estado actual.
  Object.assign(api, { getServerState: get });

  return {
    open: false,
    setOpen: (open) => set({ open }),
  };
});
