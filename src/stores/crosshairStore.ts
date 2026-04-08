import { create } from 'zustand';

interface CrosshairState {
  /** Index of the active bar (into candles array) */
  activeBarIndex: number | null;
  /** Pixel X coordinate snapped to bar center */
  snapX: number | null;
  /** Pixel Y coordinate (raw mouse) */
  mouseY: number | null;
  /** Price at current Y position */
  priceAtY: number | null;
  /** Time string of active bar */
  timeLabel: string | null;
  /** Which chart area the mouse is in: 'kline' | 'volume' | 'indicator' | null */
  activeChart: 'kline' | 'volume' | 'indicator' | null;
  setPosition: (data: Partial<CrosshairState>) => void;
  clear: () => void;
}

export const useCrosshairStore = create<CrosshairState>((set) => ({
  activeBarIndex: null,
  snapX: null,
  mouseY: null,
  priceAtY: null,
  timeLabel: null,
  activeChart: null,
  setPosition: (data) => set(data),
  clear: () =>
    set({
      activeBarIndex: null,
      snapX: null,
      mouseY: null,
      priceAtY: null,
      timeLabel: null,
      activeChart: null,
    }),
}));
