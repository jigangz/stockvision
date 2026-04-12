import { create } from 'zustand';

const CONFIG_URL = 'http://localhost:8899/api/config';

/**
 * Default rightOffset by period type.
 * - 分钟线: 30 bars (short-term trading needs more lookahead space)
 * - 日线: 23 bars (~1 month of trading days)
 * - 周线: 10 bars (~10 weeks)
 * - 月线+: 6 bars
 */
export function getDefaultRightOffset(period: string): number {
  if (period.startsWith('min') || period.endsWith('分')) return 30;
  if (period === 'daily' || period === '日') return 23;
  if (period === 'weekly' || period === '周') return 10;
  // monthly, quarterly, yearly
  return 6;
}

export interface ChartSettings {
  rightOffset: number;
  fetchDays: number;
  /** How many days to show on screen initially (zoom level). Separate from fetchDays. */
  displayDays: number;
  priceScaleMode: 'auto' | 'manual';
  priceMin: number | null;
  priceMax: number | null;
}

interface ChartSettingsActions {
  setRightOffset: (v: number) => void;
  setFetchDays: (v: number) => void;
  setDisplayDays: (v: number) => void;
  setPriceScale: (mode: 'auto' | 'manual', min?: number | null, max?: number | null) => void;
  fetchSettings: () => Promise<void>;
  saveSettings: (overrides?: Partial<ChartSettings>) => Promise<void>;
}

export const useChartSettingsStore = create<ChartSettings & ChartSettingsActions>((set, get) => ({
  rightOffset: 23,
  fetchDays: 99999,
  displayDays: 280,
  priceScaleMode: 'auto',
  priceMin: null,
  priceMax: null,

  setRightOffset: (v: number) => set({ rightOffset: v }),
  setFetchDays: (v: number) => set({ fetchDays: v }),
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
      if (data.fetchDays !== undefined) updates.fetchDays = parseInt(data.fetchDays, 10);
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
      ['fetchDays', String(state.fetchDays)],
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
