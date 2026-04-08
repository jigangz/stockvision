import { create } from 'zustand';

export type IndicatorType =
  | 'MACD' | 'DMA' | 'DMI' | 'TRIX' | 'FSL' | 'EMV'
  | 'RSI' | 'KDJ' | 'WR' | 'CCI' | 'ROC' | 'MTM' | 'PSY'
  | 'VOL' | 'OBV' | 'VR' | 'ASI' | 'BOLL' | 'SAR' | 'BRAR' | 'CR' | 'MOST';

export const ALL_INDICATORS: IndicatorType[] = [
  'MACD', 'DMA', 'DMI', 'TRIX', 'FSL', 'EMV',
  'RSI', 'KDJ', 'WR', 'CCI', 'ROC', 'MTM', 'PSY',
  'VOL', 'OBV', 'VR', 'ASI', 'BOLL', 'SAR', 'BRAR', 'CR', 'MOST',
];

export interface IndicatorSeries {
  name: string;
  type: 'line' | 'histogram';
  data: Array<{ time: string; value: number; color?: string }>;
}

export interface IndicatorResult {
  indicator: string;
  series: IndicatorSeries[];
}

interface IndicatorState {
  activeIndicator: IndicatorType;
  indicatorData: IndicatorResult | null;
  loading: boolean;
  error: string | null;
}

interface IndicatorActions {
  setActiveIndicator: (indicator: IndicatorType) => void;
  setIndicatorData: (data: IndicatorResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useIndicatorStore = create<IndicatorState & IndicatorActions>((set) => ({
  activeIndicator: 'MACD',
  indicatorData: null,
  loading: false,
  error: null,

  setActiveIndicator: (indicator) => set({ activeIndicator: indicator }),
  setIndicatorData: (data) => set({ indicatorData: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
