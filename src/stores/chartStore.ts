import { create } from 'zustand';

interface TimeRange {
  from: string;
  to: string;
}

interface ChartState {
  currentCode: string;
  currentMarket: 'SH' | 'SZ';
  currentPeriod: string;
  timeRange: TimeRange | null;
}

interface ChartActions {
  setCode: (code: string) => void;
  setMarket: (market: 'SH' | 'SZ') => void;
  setPeriod: (period: string) => void;
  setTimeRange: (range: TimeRange | null) => void;
}

export const useChartStore = create<ChartState & ChartActions>((set) => ({
  currentCode: '000001',
  currentMarket: 'SH',
  currentPeriod: 'daily',
  timeRange: null,

  setCode: (code: string) => set({ currentCode: code }),
  setMarket: (market: 'SH' | 'SZ') => set({ currentMarket: market }),
  setPeriod: (period: string) => set({ currentPeriod: period }),
  setTimeRange: (range: TimeRange | null) => set({ timeRange: range }),
}));
