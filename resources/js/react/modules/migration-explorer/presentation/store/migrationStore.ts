import { create } from "zustand";

import type { LayerKey } from "../../domain/value-objects/BoundedContextMap";

interface MigrationStoreState {
  drill: (moduleKey: string) => void;
  moveFile: (moduleKey: string, fromLayer: LayerKey, path: string, toLayer: LayerKey) => void;
  toggleValidated: (moduleKey: string) => void;
}

// Estado compartido entre los nodos de React Flow y el controlador (regla del proyecto: no
// pasar setters por props a traves de los nodos). La pagina registra los handlers reales.
export const useMigrationStore = create<MigrationStoreState>(() => ({
  drill: () => {},
  moveFile: () => {},
  toggleValidated: () => {},
}));

export function registerMigrationInteractions(state: Partial<MigrationStoreState>): void {
  useMigrationStore.setState(state);
}
