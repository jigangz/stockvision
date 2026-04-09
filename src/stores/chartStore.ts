import { create } from 'zustand';
import { detectMarket } from '@/utils/market';

interface TimeRange {
  from: string;
  to: string;
}

interface ChartState {
  currentCode: string;
  currentMarket: 'SH' | 'SZ';
  currentPeriod: string;
  timeRange: TimeRange | null;
  activeView: 'chart' | 'market';
  zoomLevel: 0 | 1 | 2;
}

interface ChartActions {
  setCode: (code: string) => void;
  setMarket: (market: 'SH' | 'SZ') => void;
  setPeriod: (period: string) => void;
  setTimeRange: (range: TimeRange | null) => void;
  setActiveView: (view: 'chart' | 'market') => void;
  setZoomLevel: (level: 0 | 1 | 2) => void;
}

export const useChartStore = create<ChartState & ChartActions>((set) => ({
  currentCode: '000001',
  currentMarket: 'SZ',
  currentPeriod: 'daily',
  timeRange: null,
  activeView: 'chart',
  zoomLevel: 0,

  setCode: (code: string) => set({ currentCode: code, currentMarket: detectMarket(code) }),
  setMarket: (market: 'SH' | 'SZ') => set({ currentMarket: market }),
  setPeriod: (period: string) => set({ currentPeriod: period }),
  setTimeRange: (range: TimeRange | null) => set({ timeRange: range }),
  setActiveView: (view: 'chart' | 'market') => set({ activeView: view }),
  setZoomLevel: (level: 0 | 1 | 2) => set({ zoomLevel: level }),
}));
