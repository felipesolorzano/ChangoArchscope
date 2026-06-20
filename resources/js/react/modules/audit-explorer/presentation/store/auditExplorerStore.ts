import { create } from "zustand";

interface AuditExplorerState {
  focusedNodeId: string | null;
  setFocusedNodeId: (nodeId: string | null) => void;
  clearFocus: () => void;
}

export const useAuditExplorerStore = create<AuditExplorerState>((set) => ({
  focusedNodeId: null,
  setFocusedNodeId: (nodeId) => set({ focusedNodeId: nodeId }),
  clearFocus: () => set({ focusedNodeId: null }),
}));
