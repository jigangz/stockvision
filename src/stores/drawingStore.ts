import { create } from 'zustand';

const API_BASE = 'http://localhost:8899';

export interface DrawingPoint {
  time: number; // UTCTimestamp (seconds since epoch)
  price: number;
}

export type DrawingToolType =
  | 'trendline'
  | 'ray'
  | 'segment'
  | 'horizontal'
  | 'vertical'
  | 'channel'
  | 'fibRetracement'
  | 'fibExtension'
  | 'gannAngle'
  | 'gannFan'
  | 'gannGrid'
  | 'gannSquare'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'text'
  | 'buyMark'
  | 'sellMark'
  | 'flatMark'
  | 'parallel_line'
  | 'price_line'
  | 'arrow'
  | 'arc'
  | 'fib_fan'
  | 'fib_arc'
  | 'fib_timezone'
  | 'pitchfork'
  | 'speedResistance'
  | 'percentLine'
  | 'cycleLine'
  | 'regressionChannel'
  | 'measure';

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export interface Drawing {
  id: string;
  type: DrawingToolType;
  points: DrawingPoint[];
  style: DrawingStyle;
  text?: string;
  locked?: boolean;
  editing?: boolean;
}

const DEFAULT_STYLE: DrawingStyle = {
  color: '#FFFF00',
  lineWidth: 1,
  lineStyle: 'solid',
};

let _idCounter = 0;
function genId(): string {
  return `drawing_${Date.now()}_${++_idCounter}`;
}

interface DrawingContext {
  code: string;
  period: string;
}

interface DrawingState {
  drawings: Drawing[];
  activeTool: DrawingToolType | null;
  activeStyle: DrawingStyle;
  selectedId: string | null;
  pendingPoints: DrawingPoint[];
  context: DrawingContext | null;
}

interface DrawingActions {
  setActiveTool: (tool: DrawingToolType | null) => void;
  setActiveStyle: (style: Partial<DrawingStyle>) => void;
  addPendingPoint: (point: DrawingPoint) => void;
  clearPending: () => void;
  commitDrawing: (drawing: Omit<Drawing, 'id'>) => string;
  removeDrawing: (id: string) => void;
  clearAll: () => void;
  selectDrawing: (id: string | null) => void;
  toggleLock: (id: string) => void;
  setEditing: (id: string | null) => void;
  setDrawings: (drawings: Drawing[]) => void;
  setContext: (code: string, period: string) => void;
  loadDrawings: (code: string, period: string) => Promise<void>;
}

export const useDrawingStore = create<DrawingState & DrawingActions>((set, get) => ({
  drawings: [],
  activeTool: null,
  activeStyle: DEFAULT_STYLE,
  selectedId: null,
  pendingPoints: [],
  context: null,

  setActiveTool: (tool) => set({ activeTool: tool, pendingPoints: [] }),

  setActiveStyle: (style) =>
    set((s) => ({ activeStyle: { ...s.activeStyle, ...style } })),

  addPendingPoint: (point) =>
    set((s) => ({ pendingPoints: [...s.pendingPoints, point] })),

  clearPending: () => set({ pendingPoints: [] }),

  commitDrawing: (drawing) => {
    const id = genId();
    const full: Drawing = { ...drawing, id };
    set((s) => ({
      drawings: [...s.drawings, full],
      pendingPoints: [],
    }));
    // Persist async (fire-and-forget)
    const ctx = get().context;
    if (ctx) {
      void fetch(
        `${API_BASE}/api/drawings/${id}?stock_code=${encodeURIComponent(ctx.code)}&period=${encodeURIComponent(ctx.period)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(full),
        },
      ).catch(() => undefined);
    }
    return id;
  },

  removeDrawing: (id) => {
    set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
    const ctx = get().context;
    if (ctx) {
      void fetch(
        `${API_BASE}/api/drawings/${id}?stock_code=${encodeURIComponent(ctx.code)}&period=${encodeURIComponent(ctx.period)}`,
        { method: 'DELETE' },
      ).catch(() => undefined);
    }
  },

  clearAll: () => {
    set({ drawings: [] });
    const ctx = get().context;
    if (ctx) {
      void fetch(
        `${API_BASE}/api/drawings?stock_code=${encodeURIComponent(ctx.code)}&period=${encodeURIComponent(ctx.period)}`,
        { method: 'DELETE' },
      ).catch(() => undefined);
    }
  },

  selectDrawing: (id) => set({ selectedId: id }),

  toggleLock: (id) =>
    set((s) => ({
      drawings: s.drawings.map((d) =>
        d.id === id ? { ...d, locked: !d.locked } : d,
      ),
    })),

  setEditing: (id) =>
    set((s) => ({
      drawings: s.drawings.map((d) =>
        d.id === id ? { ...d, editing: true } : d.editing ? { ...d, editing: false } : d,
      ),
    })),

  setDrawings: (drawings) => set({ drawings }),

  setContext: (code, period) => set({ context: { code, period } }),

  loadDrawings: async (code: string, period: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/drawings?stock_code=${encodeURIComponent(code)}&period=${encodeURIComponent(period)}`,
      );
      if (res.ok) {
        const drawings = (await res.json()) as Drawing[];
        set({ drawings, context: { code, period } });
      }
    } catch {
      // Backend may not be running in dev; silently ignore
      set({ context: { code, period } });
    }
  },
}));
