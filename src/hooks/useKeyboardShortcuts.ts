import { useEffect, useRef } from 'react';
import { ActionType } from 'klinecharts';
import type { KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { scrollFitAll } from '@/chart/patchBarSpace';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDrawingStore } from '@/stores/drawingStore';

/**
 * HQChart-style zoom presets: [barWidth, gapWidth]
 * Index 0 = most zoomed in, index 19 = most zoomed out (1px per bar).
 * Total barSpace = barWidth + gapWidth.
 */
const ZOOM_SEED: [number, number][] = [
  [48, 10], [44, 10], [40, 9], [36, 9],
  [32, 8],  [28, 8],  [24, 7], [20, 7],
  [18, 6],  [16, 6],  [15, 5], [13, 5],
  [9, 4],   [7, 4],   [5, 4],  [3, 3],
  [3, 1],   [2, 1],   [1, 1],  [1, 0],
];

const MAX_ZOOM_INDEX = ZOOM_SEED.length - 1;

/** Find the closest zoom index for a given barSpace value. */
function findClosestZoomIndex(barSpace: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < ZOOM_SEED.length; i++) {
    const total = ZOOM_SEED[i][0] + ZOOM_SEED[i][1];
    const diff = Math.abs(total - barSpace);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

interface Options {
  chartWrapper: React.RefObject<KLineChartWrapperHandle | null>;
  onRefresh: () => void;
  onStockInfo: () => void;
  anyDialogOpen: boolean;
  onCloseDialog: () => void;
  onEnterCode: () => void;
}

export function useKeyboardShortcuts({
  chartWrapper,
  onRefresh,
  onStockInfo,
  anyDialogOpen,
  onCloseDialog,
  onEnterCode,
}: Options): void {
  const optsRef = useRef({ chartWrapper, onRefresh, onStockInfo, anyDialogOpen, onCloseDialog, onEnterCode });
  useEffect(() => {
    optsRef.current = { chartWrapper, onRefresh, onStockInfo, anyDialogOpen, onCloseDialog, onEnterCode };
  });

  const keyboardNavRef = useRef(false);
  const zoomIndexRef = useRef<number | null>(null);
  /** Long-press auto-repeat state */
  const repeatRef = useRef<{ key: string; timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({
    key: '', timer: null, interval: null,
  });

  useEffect(() => {
    const exitNavMode = () => {
      if (keyboardNavRef.current) {
        keyboardNavRef.current = false;
        useCrosshairStore.getState().clear();
      }
    };
    const handleClick = () => {
      if (keyboardNavRef.current) {
        keyboardNavRef.current = false;
      }
      const cw = optsRef.current.chartWrapper.current;
      const idx = cw?.lastHoveredDataIndex;
      if (idx != null) {
        useCrosshairStore.getState().setPosition({ activeBarIndex: idx });
      }
    };
    window.addEventListener('mousemove', exitNavMode);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('mousemove', exitNavMode);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  useEffect(() => {
    /** Move crosshair by one bar, scroll chart if at visible edge. */
    function moveCrosshair(direction: -1 | 1) {
      const cwRef = optsRef.current.chartWrapper;
      const chart = cwRef.current?.chart;
      if (!chart) return;

      const klineData = chart.getDataList();
      if (!klineData.length) return;

      keyboardNavRef.current = true;
      const { activeBarIndex } = useCrosshairStore.getState();
      const visible = chart.getVisibleRange();

      // First press: start from last hovered position, or rightmost visible bar
      let startIdx: number;
      if (activeBarIndex != null) {
        startIdx = activeBarIndex;
      } else {
        const hovered = cwRef.current?.lastHoveredDataIndex;
        startIdx = hovered ?? Math.min(visible.to - 1, klineData.length - 1);
      }

      const nextIndex = Math.max(0, Math.min(klineData.length - 1, startIdx + direction));
      if (nextIndex === startIdx) return;

      // At visible edge → scroll chart by one bar width to keep crosshair visible
      if (nextIndex <= visible.from || nextIndex >= visible.to - 1) {
        const barSpace = chart.getBarSpace();
        chart.scrollByDistance(direction * -barSpace);
      }

      const bar = klineData[nextIndex];
      if (bar) {
        const coord = chart.convertToPixel(
          { timestamp: bar.timestamp, value: bar.close },
          { paneId: 'candle_pane' },
        );
        chart.executeAction(ActionType.OnCrosshairChange, {
          x: (coord as { x?: number }).x,
          y: (coord as { y?: number }).y,
          paneId: 'candle_pane',
          dataIndex: nextIndex,
          kLineData: bar,
        });
      }
      useCrosshairStore.getState().setPosition({ activeBarIndex: nextIndex });
    }

    function clearRepeat() {
      const r = repeatRef.current;
      if (r.timer) { clearTimeout(r.timer); r.timer = null; }
      if (r.interval) { clearInterval(r.interval); r.interval = null; }
      r.key = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const { chartWrapper: cwRef, onRefresh: refresh, onStockInfo: stockInfo, anyDialogOpen: dialogOpen, onCloseDialog: closeDialog, onEnterCode: enterCode } = optsRef.current;
      const chart = cwRef.current?.chart;

      if (e.key === 'Escape') {
        const { activeTool, pendingPoints, setActiveTool, clearPending } = useDrawingStore.getState();
        if (pendingPoints.length > 0) { clearPending(); e.preventDefault(); return; }
        if (activeTool) { setActiveTool(null); e.preventDefault(); return; }
        if (dialogOpen) { closeDialog(); e.preventDefault(); return; }
        const chartState = useChartStore.getState();
        if (chartState.activeView === 'chart') { chartState.setActiveView('market'); e.preventDefault(); }
        return;
      }

      if (inInput) return;

      if (e.key === 'F5') { e.preventDefault(); refresh(); return; }

      if (e.key === 'F6') {
        e.preventDefault();
        const cs = useChartStore.getState();
        cs.setActiveView(cs.activeView === 'chart' ? 'market' : 'chart');
        return;
      }

      if (e.key === 'F10') { e.preventDefault(); stockInfo(); return; }
      if (e.key === 'Enter') { e.preventDefault(); enterCode(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const { drawings, removeDrawing } = useDrawingStore.getState();
        if (drawings.length > 0) removeDrawing(drawings[drawings.length - 1].id);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        const { selectedId, removeDrawing } = useDrawingStore.getState();
        if (selectedId) removeDrawing(selectedId);
        return;
      }

      // Left/Right: move crosshair one bar, scroll at edge, long-press auto-repeat
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.repeat) return; // let our own repeat handle it

        const dir: -1 | 1 = e.key === 'ArrowLeft' ? -1 : 1;
        moveCrosshair(dir);

        // Start long-press timer (500ms delay, then 80ms repeat)
        clearRepeat();
        repeatRef.current.key = e.key;
        repeatRef.current.timer = setTimeout(() => {
          repeatRef.current.interval = setInterval(() => moveCrosshair(dir), 80);
        }, 500);
        return;
      }

      // Up/Down: stepped zoom using ZOOM_SEED (HQChart/通达信 style)
      // Beyond ZOOM_SEED[19] = [1,0], continue with sub-pixel barSpace
      // so 8000+ bars can fit on one screen (like TDX extreme zoom out).
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        if (!chart) return;

        const klineData = chart.getDataList();
        const totalBars = klineData.length;
        const chartEl = (chart as unknown as { getContainer?: () => HTMLElement }).getContainer?.();
        const chartWidth = chartEl ? chartEl.clientWidth - 60 : 800;
        const currentBarSpace = chart.getBarSpace();
        const isZoomIn = e.key === 'ArrowUp' || e.key === 'PageUp';

        // Init zoomIndex from current barSpace if needed
        if (zoomIndexRef.current === null) {
          zoomIndexRef.current = findClosestZoomIndex(currentBarSpace);
        }

        // Minimum possible barSpace: fit all bars in chart width
        const fitAllBarSpace = totalBars > 0 ? chartWidth / totalBars : 1;

        if (isZoomIn) {
          // --- ZOOM IN ---
          const step = e.key === 'PageUp' ? 3 : 1;
          if (currentBarSpace < 1) {
            // Currently sub-pixel → zoom in by doubling
            const newBarSpace = Math.min(1, currentBarSpace * (e.key === 'PageUp' ? 8 : 2));
            if (newBarSpace >= 1) {
              // Back to ZOOM_SEED range
              zoomIndexRef.current = MAX_ZOOM_INDEX;
              chart.setBarSpace(ZOOM_SEED[MAX_ZOOM_INDEX][0] + ZOOM_SEED[MAX_ZOOM_INDEX][1]);
            } else {
              chart.setBarSpace(newBarSpace);
              scrollFitAll(chart);
            }
          } else {
            // In ZOOM_SEED range
            const idx = Math.max(0, zoomIndexRef.current - step);
            zoomIndexRef.current = idx;
            chart.setBarSpace(ZOOM_SEED[idx][0] + ZOOM_SEED[idx][1]);
          }
        } else {
          // --- ZOOM OUT ---
          const step = e.key === 'PageDown' ? 3 : 1;
          if (zoomIndexRef.current < MAX_ZOOM_INDEX) {
            // Still in ZOOM_SEED range
            const idx = Math.min(MAX_ZOOM_INDEX, zoomIndexRef.current + step);
            zoomIndexRef.current = idx;
            const newBarSpace = ZOOM_SEED[idx][0] + ZOOM_SEED[idx][1];
            chart.setBarSpace(newBarSpace);

            // If all data fits after this zoom, remove left gap
            if (totalBars <= chartWidth / newBarSpace) {
              scrollFitAll(chart);
            }
          } else {
            // At or beyond ZOOM_SEED max → sub-pixel zoom
            const newBarSpace = Math.max(
              fitAllBarSpace,
              currentBarSpace * (e.key === 'PageDown' ? 0.125 : 0.5),
            );
            if (newBarSpace < currentBarSpace) {
              chart.setBarSpace(newBarSpace);
              scrollFitAll(chart);
            }
          }
        }
        return;
      }

      if (e.key === 'Home') { e.preventDefault(); if (chart) chart.scrollToDataIndex(0); return; }
      if (e.key === 'End') { e.preventDefault(); if (chart) chart.scrollToRealTime(); return; }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === repeatRef.current.key) {
        clearRepeat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearRepeat();
    };
  }, []);
}
