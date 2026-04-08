import { create } from 'zustand';

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
  | 'rectangle'
  | 'text';

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

interface DrawingState {
  drawings: Drawing[];
  activeTool: DrawingToolType | null;
  activeStyle: DrawingStyle;
  selectedId: string | null;
  pendingPoints: DrawingPoint[];
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
  setDrawings: (drawings: Drawing[]) => void;
}

export const useDrawingStore = create<DrawingState & DrawingActions>((set) => ({
  drawings: [],
  activeTool: null,
  activeStyle: DEFAULT_STYLE,
  selectedId: null,
  pendingPoints: [],

  setActiveTool: (tool) => set({ activeTool: tool, pendingPoints: [] }),

  setActiveStyle: (style) =>
    set((s) => ({ activeStyle: { ...s.activeStyle, ...style } })),

  addPendingPoint: (point) =>
    set((s) => ({ pendingPoints: [...s.pendingPoints, point] })),

  clearPending: () => set({ pendingPoints: [] }),

  commitDrawing: (drawing) => {
    const id = genId();
    set((s) => ({
      drawings: [...s.drawings, { ...drawing, id }],
      pendingPoints: [],
    }));
    return id;
  },

  removeDrawing: (id) =>
    set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) })),

  clearAll: () => set({ drawings: [] }),

  selectDrawing: (id) => set({ selectedId: id }),

  setDrawings: (drawings) => set({ drawings }),
}));
