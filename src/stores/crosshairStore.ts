import { create } from "zustand";

interface CrosshairState {
  activeBarIndex: number | null;
  snapX: number | null;
  mouseY: number | null;
  priceAtY: number | null;
  timeLabel: string | null;
  activeChart: "kline" | "volume" | "indicator" | null;
  isKeyboardNavMode: boolean;
  setPosition: (data: Partial<CrosshairState>) => void;
  setKeyboardNavMode: (mode: boolean) => void;
  clear: () => void;
}

export const useCrosshairStore = create<CrosshairState>((set) => ({
  activeBarIndex: null,
  snapX: null,
  mouseY: null,
  priceAtY: null,
  timeLabel: null,
  activeChart: null,
  isKeyboardNavMode: false,
  setPosition: (data) => set(data),
  setKeyboardNavMode: (mode) => set({ isKeyboardNavMode: mode }),
  clear: () =>
    set({
      activeBarIndex: null,
      snapX: null,
      mouseY: null,
      priceAtY: null,
      timeLabel: null,
      activeChart: null,
      isKeyboardNavMode: false,
    }),
}));
