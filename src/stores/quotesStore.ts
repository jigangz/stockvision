import { create } from 'zustand';

export interface QuoteData {
  code: string;
  name: string;
  price: number;
  change_pct: number;
  change_amount: number;
  volume: number;
  amount: number;
  open: number;
  prev_close: number;
  high: number;
  low: number;
  turnover_rate: number;
  pe_ratio: number;
  amplitude: number;
  quantity_ratio: number;
}

interface QuotesState {
  quotes: Map<string, QuoteData>;
  loading: boolean;
  pollingId: ReturnType<typeof setInterval> | null;
}

interface QuotesActions {
  fetchAllQuotes: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useQuotesStore = create<QuotesState & QuotesActions>((set, get) => ({
  quotes: new Map(),
  loading: false,
  pollingId: null,

  fetchAllQuotes: async () => {
    set({ loading: true });
    try {
      // Try /api/data/quotes first (full quote data), fall back to /api/data/stocks (name only)
      let res = await fetch('http://localhost:8899/api/data/quotes');
      if (res.ok) {
        const list = (await res.json()) as QuoteData[];
        const map = new Map<string, QuoteData>();
        for (const q of list) map.set(q.code, q);
        set({ quotes: map });
        return;
      }

      // Fallback: fetch stock list for names
      res = await fetch('http://localhost:8899/api/data/stocks');
      if (res.ok) {
        const json = (await res.json()) as { stocks: Array<{ code: string; name: string }> };
        const map = new Map<string, QuoteData>();
        for (const s of json.stocks) {
          map.set(s.code, { code: s.code, name: s.name } as QuoteData);
        }
        set({ quotes: map });
      }
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  startPolling: () => {
    const { pollingId, fetchAllQuotes } = get();
    if (pollingId !== null) return;
    void fetchAllQuotes();
    const id = setInterval(() => {
      void fetchAllQuotes();
    }, 30000);
    set({ pollingId: id });
  },

  stopPolling: () => {
    const { pollingId } = get();
    if (pollingId !== null) {
      clearInterval(pollingId);
      set({ pollingId: null });
    }
  },
}));
