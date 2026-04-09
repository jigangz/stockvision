import { create } from 'zustand';

interface WatchlistState {
  codes: string[];
}

interface WatchlistActions {
  addCode: (code: string) => void;
  removeCode: (code: string) => void;
  toggleCode: (code: string) => void;
  fetchWatchlist: () => Promise<void>;
  saveWatchlist: (codes: string[]) => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState & WatchlistActions>((set, get) => ({
  codes: [],

  addCode: (code: string) => {
    const { codes, saveWatchlist } = get();
    if (!codes.includes(code)) {
      const next = [...codes, code];
      set({ codes: next });
      void saveWatchlist(next);
    }
  },

  removeCode: (code: string) => {
    const { codes, saveWatchlist } = get();
    const next = codes.filter((c) => c !== code);
    set({ codes: next });
    void saveWatchlist(next);
  },

  toggleCode: (code: string) => {
    const { codes } = get();
    if (codes.includes(code)) {
      get().removeCode(code);
    } else {
      get().addCode(code);
    }
  },

  fetchWatchlist: async () => {
    try {
      const res = await fetch('http://localhost:8899/api/config/watchlist');
      if (res.ok) {
        const data = (await res.json()) as string[];
        set({ codes: Array.isArray(data) ? data : [] });
      }
    } catch {
      // ignore
    }
  },

  saveWatchlist: async (codes: string[]) => {
    try {
      await fetch('http://localhost:8899/api/config/watchlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codes),
      });
    } catch {
      // ignore
    }
  },
}));
