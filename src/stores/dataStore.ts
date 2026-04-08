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
  error: string | null;
}

interface DataActions {
  fetchKline: (code: string, market: string, period: string) => Promise<void>;
}

export const useDataStore = create<DataState & DataActions>((set) => ({
  candles: [],
  loading: false,
  error: null,

  fetchKline: async (code: string, market: string, period: string) => {
    set({ loading: true, error: null });
    try {
      const url = `http://localhost:8899/api/data/kline?code=${code}&market=${market}&period=${period}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json: unknown = await res.json();

      // Handle both { data: [...] } wrapper and raw array
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

      // Normalize: API may return 'date' instead of 'time'
      const data: OhlcvData[] = rawData.map((d) => ({
        time: (d.time ?? d.date) as string,
        open: d.open as number,
        high: d.high as number,
        low: d.low as number,
        close: d.close as number,
        volume: d.volume as number,
        amount: d.amount as number | undefined,
      }));

      set({ candles: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false, candles: [] });
    }
  },
}));
