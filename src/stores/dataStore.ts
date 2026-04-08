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

/** How many bars to show on initial load (first screen). */
const INITIAL_BAR_LIMIT = 100;
/** How many additional bars to load each time user scrolls to the left edge. */
const LAZY_LOAD_BATCH = 200;

interface DataState {
  candles: OhlcvData[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** True when all historical bars have been loaded (no more to fetch). */
  allLoaded: boolean;
  /** Current fetch context — used by fetchMoreBars to know what to load next. */
  _fetchContext: { code: string; market: string; period: string; start: string } | null;
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

export const useDataStore = create<DataState & DataActions>((set, get) => ({
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

  // Fast initial load: only the last INITIAL_BAR_LIMIT bars
  fetchKlineInitial: async (code, market, period, start, end) => {
    set({ loading: true, error: null, allLoaded: false });
    try {
      const url =
        `http://localhost:8899/api/data/kline?code=${code}&market=${market}&period=${period}` +
        `&start=${start}&end=${end}&limit=${INITIAL_BAR_LIMIT}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as Record<string, unknown>;
      const data = parseResponse(json);

      // has_more tells us if there are older bars to load
      const hasMore = (json.has_more as boolean | undefined) ?? data.length >= INITIAL_BAR_LIMIT;
      set({
        candles: data,
        loading: false,
        allLoaded: !hasMore,
        _fetchContext: { code, market, period, start },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false, candles: [] });
    }
  },

  // Lazy load: prepend older bars before the currently loaded set
  fetchMoreBars: async () => {
    const state = get();
    if (state.loadingMore || state.allLoaded || !state._fetchContext) return;
    const { code, market, period, start } = state._fetchContext;

    set({ loadingMore: true });
    try {
      // offset = number of bars already loaded; load the batch before that
      const alreadyLoaded = state.candles.length;
      const url =
        `http://localhost:8899/api/data/kline?code=${code}&market=${market}&period=${period}` +
        `&start=${start}&limit=${LAZY_LOAD_BATCH}&offset=${alreadyLoaded}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = (await res.json()) as Record<string, unknown>;
      const older = parseResponse(json);
      const hasMore = (json.has_more as boolean | undefined) ?? older.length >= LAZY_LOAD_BATCH;

      if (older.length === 0) {
        set({ loadingMore: false, allLoaded: true });
        return;
      }

      // Prepend older bars (they come back in chronological order already)
      set((s) => ({
        candles: [...older, ...s.candles],
        loadingMore: false,
        allLoaded: !hasMore,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ loadingMore: false, error: message });
    }
  },
}));
