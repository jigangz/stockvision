import { create } from 'zustand';

export interface OhlcvData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

interface DataState {
  candles: OhlcvData[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  allLoaded: boolean;
  _fetchContext: null;
}

interface DataActions {
  fetchKline: (code: string, market: string, period: string, start?: string, end?: string) => Promise<void>;
  /** Load the initial screen (last INITIAL_BAR_LIMIT bars) for fast first paint. */
  fetchKlineInitial: (code: string, market: string, period: string, start: string, end: string) => Promise<void>;
  /** Prepend older bars (lazy load when user scrolls left). */
  fetchMoreBars: () => Promise<void>;
}

function parseResponse(json: unknown): OhlcvData[] {
  let rawData: Record<string, unknown>[];
  if (Array.isArray(json)) {
    rawData = json as Record<string, unknown>[];
  } else if (
    typeof json === 'object' &&
    json !== null &&
    'data' in json &&
    Array.isArray((json as Record<string, unknown>).data)
  ) {
    rawData = (json as Record<string, unknown>).data as Record<string, unknown>[];
  } else {
    throw new Error('Unexpected response format');
  }

  return rawData.map((d) => ({
    time: (d.time ?? d.date) as string,
    open: d.open as number,
    high: d.high as number,
    low: d.low as number,
    close: d.close as number,
    volume: d.volume as number,
    amount: d.amount as number | undefined,
  }));
}

export const useDataStore = create<DataState & DataActions>((set) => ({
  candles: [],
  loading: false,
  loadingMore: false,
  error: null,
  allLoaded: false,
  _fetchContext: null,

  // Legacy full-range fetch (used by backtest, stats, etc.)
  fetchKline: async (code, market, period, start?, end?) => {
    set({ loading: true, error: null });
    try {
      let url = `http://localhost:8899/api/data/kline?code=${code}&market=${market}&period=${period}`;
      if (start) url += `&start=${start}`;
      if (end) url += `&end=${end}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: unknown = await res.json();
      const data = parseResponse(json);
      set({ candles: data, loading: false, allLoaded: true, _fetchContext: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false, candles: [] });
    }
  },

  // Load all data for a stock at once (local TDX files are fast enough)
  fetchKlineInitial: async (code, market, period, start, end) => {
    // Clear previous stock data immediately to free memory
    set({ candles: [], loading: true, error: null, allLoaded: false, _fetchContext: null });
    try {
      const url =
        `http://localhost:8899/api/data/kline?code=${code}&market=${market}&period=${period}` +
        `&start=${start}&end=${end}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: unknown = await res.json();
      const data = parseResponse(json);
      set({
        candles: data,
        loading: false,
        allLoaded: true,
        _fetchContext: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false, candles: [] });
    }
  },

  // No-op: all data loaded at once, no lazy loading needed
  fetchMoreBars: async () => {},
}));
