import { create } from "zustand";

import type { DependencyStatus, RuntimeChoice, RuntimeKind } from "../../domain/value-objects/DependencyReport";

export type StatusFilter = DependencyStatus | "all";

interface DependenciesExplorerData {
  /** Runtime elegido por el usuario; un kind ausente usa el detectado. */
  runtimes: RuntimeChoice;
  status: StatusFilter;
  query: string;
  hideDev: boolean;
  onlyVulnerable: boolean;
  /** Llave ecosystem:name del paquete abierto en el drawer. */
  selected: string | null;
}

interface DependenciesExplorerState extends DependenciesExplorerData {
  setRuntime: (kind: RuntimeKind, version: string) => void;
  toggleStatus: (status: DependencyStatus) => void;
  setQuery: (query: string) => void;
  setHideDev: (hideDev: boolean) => void;
  toggleVulnerable: () => void;
  select: (key: string | null) => void;
}

export function initialDependenciesExplorerState(): DependenciesExplorerData {
  return { runtimes: {}, status: "all", query: "", hideDev: false, onlyVulnerable: false, selected: null };
}

export const useDependenciesExplorerStore = create<DependenciesExplorerState>((set, get, api) => {
  // La app no se renderiza en servidor: el snapshot "de servidor" de zustand (el que usa
  // renderToStaticMarkup en los tests de componentes) debe ser el estado actual, no el inicial.
  Object.assign(api, { getServerState: get });

  return {
    ...initialDependenciesExplorerState(),
    setRuntime: (kind, version) => set((state) => ({ runtimes: { ...state.runtimes, [kind]: version } })),
    toggleStatus: (status) => set((state) => ({ status: state.status === status ? "all" : status })),
    setQuery: (query) => set({ query }),
    setHideDev: (hideDev) => set({ hideDev }),
    toggleVulnerable: () => set((state) => ({ onlyVulnerable: !state.onlyVulnerable })),
    select: (selected) => set({ selected }),
  };
});
