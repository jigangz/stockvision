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

/** Default parameters for each indicator — mirrors the Python calc function signatures. */
export const INDICATOR_DEFAULTS: Record<string, Record<string, number>> = {
  MACD: { fast: 12, slow: 26, signal: 9 },
  DMA: { n1: 10, n2: 50, m: 10 },
  DMI: { period: 14 },
  TRIX: { period: 12, signal: 20 },
  FSL: { fast: 5, slow: 20 },
  EMV: { period: 14, signal: 9 },
  RSI: { p1: 6, p2: 12, p3: 24 },
  KDJ: { period: 9, k_smooth: 3, d_smooth: 3 },
  WR: { p1: 10, p2: 6 },
  CCI: { period: 14 },
  ROC: { period: 12, signal: 6 },
  MTM: { period: 12, signal: 6 },
  PSY: { period: 12, signal: 6 },
  VOL: { ma1: 5, ma2: 10 },
  // OBV has no tuneable params
  VR: { period: 26 },
  ASI: { period: 14 },
  BOLL: { period: 20, std_mult: 2 },
  SAR: { initial_af: 0.02, max_af: 0.2 },
  BRAR: { period: 26 },
  CR: { period: 26, m: 5 },
  MOST: { period: 14, pct: 2 },
};

/** Human-readable labels for parameter keys. */
export const PARAM_LABELS: Record<string, string> = {
  fast: '短周期',
  slow: '长周期',
  signal: '信号周期',
  period: '周期',
  n1: 'MA短周期',
  n2: 'MA长周期',
  m: '平滑周期',
  k_smooth: 'K平滑',
  d_smooth: 'D平滑',
  p1: '周期1',
  p2: '周期2',
  p3: '周期3',
  std_mult: '标准差倍数',
  initial_af: '初始加速因子',
  max_af: '最大加速因子',
  pct: '百分比',
  ma1: 'MA1周期',
  ma2: 'MA2周期',
};

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
  /** Two independent indicator sections (like 通达信) */
  activeIndicatorUpper: IndicatorType;
  activeIndicatorLower: IndicatorType;
  activeSection: 'upper' | 'lower';
  indicatorData: IndicatorResult | null;
  loading: boolean;
  error: string | null;
  /** Per-indicator custom parameters. Missing key = use defaults. */
  indicatorParams: Record<string, Record<string, number>>;
}

interface IndicatorActions {
  setActiveIndicator: (indicator: IndicatorType) => void;
  setActiveIndicatorUpper: (indicator: IndicatorType) => void;
  setActiveIndicatorLower: (indicator: IndicatorType) => void;
  setActiveSection: (section: 'upper' | 'lower') => void;
  setIndicatorData: (data: IndicatorResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setParams: (indicator: string, params: Record<string, number>) => void;
  resetParams: (indicator: string) => void;
}

export const useIndicatorStore = create<IndicatorState & IndicatorActions>((set) => ({
  activeIndicator: 'MACD',
  activeIndicatorUpper: 'VOL',
  activeIndicatorLower: 'MACD',
  activeSection: 'lower',
  indicatorData: null,
  loading: false,
  error: null,
  indicatorParams: {},

  setActiveIndicator: (indicator) => set({ activeIndicator: indicator }),
  setActiveIndicatorUpper: (indicator) => set({ activeIndicatorUpper: indicator }),
  setActiveIndicatorLower: (indicator) => set({ activeIndicatorLower: indicator }),
  setActiveSection: (section) => set({ activeSection: section }),
  setIndicatorData: (data) => set({ indicatorData: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setParams: (indicator, params) =>
    set((s) => ({
      indicatorParams: { ...s.indicatorParams, [indicator]: params },
    })),
  resetParams: (indicator) =>
    set((s) => {
      const next = { ...s.indicatorParams };
      delete next[indicator];
      return { indicatorParams: next };
    }),
}));
