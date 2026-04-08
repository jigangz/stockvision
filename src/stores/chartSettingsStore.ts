import { create } from 'zustand';

const CONFIG_URL = 'http://localhost:8899/api/config';

export interface ChartSettings {
  rightOffset: number;
  displayDays: number;
  priceScaleMode: 'auto' | 'manual';
  priceMin: number | null;
  priceMax: number | null;
}

interface ChartSettingsActions {
  setRightOffset: (v: number) => void;
  setDisplayDays: (v: number) => void;
  setPriceScale: (mode: 'auto' | 'manual', min?: number | null, max?: number | null) => void;
  fetchSettings: () => Promise<void>;
  saveSettings: (overrides?: Partial<ChartSettings>) => Promise<void>;
}

export const useChartSettingsStore = create<ChartSettings & ChartSettingsActions>((set, get) => ({
  rightOffset: 30,
  displayDays: 280,
  priceScaleMode: 'auto',
  priceMin: null,
  priceMax: null,

  setRightOffset: (v: number) => set({ rightOffset: v }),
  setDisplayDays: (v: number) => set({ displayDays: v }),
  setPriceScale: (mode: 'auto' | 'manual', min: number | null = null, max: number | null = null) =>
    set({ priceScaleMode: mode, priceMin: min, priceMax: max }),

  fetchSettings: async () => {
    try {
      const res = await fetch(CONFIG_URL);
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, string>;
      const updates: Partial<ChartSettings> = {};
      if (data.rightOffset !== undefined) updates.rightOffset = parseInt(data.rightOffset, 10);
      if (data.displayDays !== undefined) updates.displayDays = parseInt(data.displayDays, 10);
      if (data.priceScaleMode !== undefined) updates.priceScaleMode = data.priceScaleMode as 'auto' | 'manual';
      if (data.priceMin !== undefined) updates.priceMin = parseFloat(data.priceMin);
      if (data.priceMax !== undefined) updates.priceMax = parseFloat(data.priceMax);
      set(updates);
    } catch {
      // backend not available, keep defaults
    }
  },

  saveSettings: async (overrides?: Partial<ChartSettings>) => {
    const state = { ...get(), ...overrides };
    const entries: Array<[string, string]> = [
      ['rightOffset', String(state.rightOffset)],
      ['displayDays', String(state.displayDays)],
      ['priceScaleMode', state.priceScaleMode],
    ];
    if (state.priceMin != null) entries.push(['priceMin', String(state.priceMin)]);
    if (state.priceMax != null) entries.push(['priceMax', String(state.priceMax)]);

    try {
      await Promise.all(
        entries.map(([key, value]) =>
          fetch(`${CONFIG_URL}/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          }),
        ),
      );
    } catch {
      // ignore network errors
    }
  },
}));
