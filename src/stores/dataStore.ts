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
      let data: OhlcvData[];
      if (Array.isArray(json)) {
        data = json as OhlcvData[];
      } else if (
        typeof json === 'object' &&
        json !== null &&
        'data' in json &&
        Array.isArray((json as Record<string, unknown>).data)
      ) {
        data = (json as Record<string, unknown>).data as OhlcvData[];
      } else {
        throw new Error('Unexpected response format');
      }

      set({ candles: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false, candles: [] });
    }
  },
}));
