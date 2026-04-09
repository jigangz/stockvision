import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { KLineChartHandle } from '@/components/chart/KLineChart';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDrawingStore } from '@/stores/drawingStore';

// Stock list used for up/down navigation
const STOCK_LIST: { code: string; market: 'SH' | 'SZ' }[] = [
  { code: '000001', market: 'SH' },
  { code: '600000', market: 'SH' },
  { code: '600036', market: 'SH' },
  { code: '601318', market: 'SH' },
  { code: '000858', market: 'SZ' },
  { code: '002594', market: 'SZ' },
  { code: '300750', market: 'SZ' },
  { code: '000333', market: 'SZ' },
];

interface Options {
  klineRef: React.RefObject<KLineChartHandle | null>;
  charts: (IChartApi | null)[];
  /** Called when F5 is pressed */
  onRefresh: () => void;
  /** Called when F10 is pressed */
  onStockInfo: () => void;
  /** Called when a dialog is open (used for Esc) */
  anyDialogOpen: boolean;
  /** Close the topmost dialog */
  onCloseDialog: () => void;
  /** Open stock code input */
  onEnterCode: () => void;
}

export function useKeyboardShortcuts({
  klineRef,
  charts,
  onRefresh,
  onStockInfo,
  anyDialogOpen,
  onCloseDialog,
  onEnterCode,
}: Options): void {
  // Keep refs so the handler always reads latest values without re-attaching
  const optsRef = useRef({
    klineRef,
    charts,
    onRefresh,
    onStockInfo,
    anyDialogOpen,
    onCloseDialog,
    onEnterCode,
  });
  useEffect(() => {
    optsRef.current = { klineRef, charts, onRefresh, onStockInfo, anyDialogOpen, onCloseDialog, onEnterCode };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea (except for specific shortcuts)
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const { klineRef: kRef, charts: cs, onRefresh: refresh, onStockInfo: stockInfo, anyDialogOpen: dialogOpen, onCloseDialog: closeDialog, onEnterCode: enterCode } = optsRef.current;

      const kChart = kRef.current?.chart;

      // --- Esc: cancel drawing, close dialog, or return to market view ---
      if (e.key === 'Escape') {
        const { activeTool, pendingPoints, setActiveTool, clearPending } = useDrawingStore.getState();
        if (pendingPoints.length > 0) {
          clearPending();
          e.preventDefault();
          return;
        }
        if (activeTool) {
          setActiveTool(null);
          e.preventDefault();
          return;
        }
        if (dialogOpen) {
          closeDialog();
          e.preventDefault();
          return;
        }
        // If in chart view, return to market view
        const chartState = useChartStore.getState();
        if (chartState.activeView === 'chart') {
          chartState.setActiveView('market');
          e.preventDefault();
        }
        return;
      }

      if (inInput) return; // Don't intercept inputs for the rest

      // --- F5: refresh ---
      if (e.key === 'F5') {
        e.preventDefault();
        refresh();
        return;
      }

      // --- F6: toggle chart / market view ---
      if (e.key === 'F6') {
        e.preventDefault();
        const chartState = useChartStore.getState();
        chartState.setActiveView(chartState.activeView === 'chart' ? 'market' : 'chart');
        return;
      }

      // --- F10: stock info ---
      if (e.key === 'F10') {
        e.preventDefault();
        stockInfo();
        return;
      }

      // --- Enter: code input jump ---
      if (e.key === 'Enter') {
        e.preventDefault();
        enterCode();
        return;
      }

      // --- Ctrl+Z: undo last drawing ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const { drawings, removeDrawing } = useDrawingStore.getState();
        if (drawings.length > 0) {
          removeDrawing(drawings[drawings.length - 1].id);
        }
        return;
      }

      // --- Delete: remove selected drawing ---
      if (e.key === 'Delete') {
        e.preventDefault();
        const { selectedId, removeDrawing } = useDrawingStore.getState();
        if (selectedId) {
          removeDrawing(selectedId);
        }
        return;
      }

      // --- Arrow Left/Right: move crosshair one bar ---
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const { activeBarIndex } = useCrosshairStore.getState();
        const currentCandles = useDataStore.getState().candles;
        if (activeBarIndex === null || !currentCandles.length) {
          // Initialize to last bar
          useCrosshairStore.getState().setPosition({ activeBarIndex: currentCandles.length - 1 });
          return;
        }

        let nextIndex = activeBarIndex;
        if (e.key === 'ArrowLeft') nextIndex = Math.max(0, activeBarIndex - 1);
        if (e.key === 'ArrowRight') nextIndex = Math.min(currentCandles.length - 1, activeBarIndex + 1);

        if (nextIndex !== activeBarIndex && kChart) {
          const kSeries = kRef.current?.candleSeries;
          if (kSeries) {
            const bar = currentCandles[nextIndex];
            try {
              kChart.setCrosshairPosition(
                bar.close,
                bar.time as Parameters<typeof kChart.setCrosshairPosition>[1],
                kSeries,
              );
            } catch {
              // ignore
            }
          }
          useCrosshairStore.getState().setPosition({ activeBarIndex: nextIndex });
        }
        e.preventDefault();
        return;
      }

      // --- Arrow Up/Down: switch stock ---
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const { currentCode, setCode, setMarket } = useChartStore.getState();
        const idx = STOCK_LIST.findIndex((s) => s.code === currentCode);
        let nextIdx = idx;
        if (e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
        if (e.key === 'ArrowDown') nextIdx = Math.min(STOCK_LIST.length - 1, idx + 1);
        if (nextIdx !== idx) {
          setCode(STOCK_LIST[nextIdx].code);
          setMarket(STOCK_LIST[nextIdx].market);
        }
        e.preventDefault();
        return;
      }

      // --- PageUp: zoom in (fewer bars) ---
      if (e.key === 'PageUp') {
        e.preventDefault();
        cs.forEach((chart) => {
          if (!chart) return;
          const range = chart.timeScale().getVisibleLogicalRange();
          if (!range) return;
          const size = range.to - range.from;
          const newSize = Math.max(20, size * 0.7);
          const center = (range.from + range.to) / 2;
          chart.timeScale().setVisibleLogicalRange({
            from: center - newSize / 2,
            to: center + newSize / 2,
          });
        });
        return;
      }

      // --- PageDown: zoom out (more bars) ---
      if (e.key === 'PageDown') {
        e.preventDefault();
        cs.forEach((chart) => {
          if (!chart) return;
          const range = chart.timeScale().getVisibleLogicalRange();
          if (!range) return;
          const size = range.to - range.from;
          const newSize = Math.min(500, size * 1.4);
          const center = (range.from + range.to) / 2;
          chart.timeScale().setVisibleLogicalRange({
            from: center - newSize / 2,
            to: center + newSize / 2,
          });
        });
        return;
      }

      // --- Home: jump to earliest data ---
      if (e.key === 'Home') {
        e.preventDefault();
        const totalBars = useDataStore.getState().candles.length;
        if (!totalBars) return;
        cs.forEach((chart) => {
          if (!chart) return;
          const range = chart.timeScale().getVisibleLogicalRange();
          if (!range) return;
          const size = range.to - range.from;
          chart.timeScale().setVisibleLogicalRange({ from: 0, to: size });
        });
        return;
      }

      // --- End: jump to latest data ---
      if (e.key === 'End') {
        e.preventDefault();
        const totalBars = useDataStore.getState().candles.length;
        if (!totalBars) return;
        cs.forEach((chart) => {
          if (!chart) return;
          const range = chart.timeScale().getVisibleLogicalRange();
          if (!range) return;
          const size = range.to - range.from;
          // to = totalBars - 1 + rightOffset (use current offset)
          const newTo = totalBars - 1 + 30;
          chart.timeScale().setVisibleLogicalRange({ from: newTo - size, to: newTo });
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // attach once, options read via ref
}
