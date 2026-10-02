import { create } from "zustand";

import { searchWithTarget, targetFromSearch, type ProjectTarget } from "../../domain/projectTarget";

interface ProjectTargetState {
  target: ProjectTarget;
  setTarget: (target: ProjectTarget) => void;
}

// Stack analizado (laravel/react) compartido por todas las pestañas. Vive en la URL
// (`?target=`) para sobrevivir a un reload y poder compartir el link.
export const useProjectTargetStore = create<ProjectTargetState>((set) => ({
  target: targetFromSearch(window.location.search),
  setTarget: (target) => {
    window.history.replaceState(null, "", `${window.location.pathname}${searchWithTarget(window.location.search, target)}`);
    set({ target });
  },
}));
