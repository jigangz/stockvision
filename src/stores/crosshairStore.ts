import { create } from 'zustand';

interface CrosshairState {
  activeBarIndex: number | null;
  isKeyboardNavMode: boolean;
}

interface CrosshairActions {
  setPosition: (pos: { activeBarIndex: number }) => void;
  setKeyboardNavMode: (mode: boolean) => void;
  clear: () => void;
}

export const useCrosshairStore = create<CrosshairState & CrosshairActions>((set) => ({
  activeBarIndex: null,
  isKeyboardNavMode: false,
  setPosition: (pos) => set({ activeBarIndex: pos.activeBarIndex }),
  setKeyboardNavMode: (mode) => set({ isKeyboardNavMode: mode }),
  clear: () => set({ activeBarIndex: null, isKeyboardNavMode: false }),
}));
