import { create } from 'zustand';

export interface MALine {
  period: number;
  enabled: boolean;
}

const DEFAULT_MA_LINES: MALine[] = [
  { period: 5, enabled: true },
  { period: 10, enabled: true },
  { period: 20, enabled: true },
  { period: 60, enabled: true },
  { period: 120, enabled: false },
  { period: 250, enabled: false },
  { period: 0, enabled: false },
  { period: 0, enabled: false },
  { period: 0, enabled: false },
  { period: 0, enabled: false },
];

export const MA_COLORS = [
  '#FFFF00', // MA1 yellow
  '#FF00FF', // MA2 magenta
  '#00FF00', // MA3 green
  '#FFFFFF', // MA4 white
  '#FF8800', // MA5 orange
  '#00CCFF', // MA6 cyan
  '#FF6688', // MA7 pink
  '#88FF88', // MA8 light green
  '#8888FF', // MA9 light blue
  '#FFAA44', // MA10 gold
];

interface MAState {
  lines: MALine[];
  dialogOpen: boolean;
}

interface MAActions {
  setLines: (lines: MALine[]) => void;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useMAStore = create<MAState & MAActions>((set) => ({
  lines: DEFAULT_MA_LINES,
  dialogOpen: false,

  setLines: (lines) => set({ lines }),
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
}));

/** Get the calcParams array for KLineChart (only enabled lines with period > 0) */
export function getMACalcParams(lines: MALine[]): number[] {
  return lines.filter((l) => l.enabled && l.period > 0).map((l) => l.period);
}
