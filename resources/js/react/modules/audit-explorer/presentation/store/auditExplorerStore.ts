import { create } from "zustand";

interface AuditExplorerState {
  focusedNodeId: string | null;
  setFocusedNodeId: (nodeId: string | null) => void;
  clearFocus: () => void;
  /** Modo mosaico (reemplaza al lienzo); se apaga al navegar a otra vista. */
  mosaic: boolean;
  setMosaic: (mosaic: boolean) => void;
}

export const useAuditExplorerStore = create<AuditExplorerState>((set) => ({
  focusedNodeId: null,
  setFocusedNodeId: (nodeId) => set({ focusedNodeId: nodeId }),
  clearFocus: () => set({ focusedNodeId: null }),
  mosaic: false,
  setMosaic: (mosaic) => set({ mosaic }),
}));
