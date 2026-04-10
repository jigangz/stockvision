import { useEffect, useRef } from 'react';
import { ActionType } from 'klinecharts';
import type { KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDrawingStore } from '@/stores/drawingStore';

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

  useEffect(() => {
    const exitNavMode = () => {
      if (keyboardNavRef.current) {
        keyboardNavRef.current = false;
        useCrosshairStore.getState().clear();
      }
    };
    // Click on chart → set activeBarIndex to the hovered bar (so arrow keys start from there)
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

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const { activeBarIndex } = useCrosshairStore.getState();
        const klineData = chart ? chart.getDataList() : [];
        if (!klineData.length || !chart) { e.preventDefault(); return; }

        keyboardNavRef.current = true;
        const startIdx = activeBarIndex ?? klineData.length - 1;
        let nextIndex = startIdx;
        if (e.key === 'ArrowLeft') nextIndex = Math.max(0, startIdx - 1);
        if (e.key === 'ArrowRight') nextIndex = Math.min(klineData.length - 1, startIdx + 1);

        chart.scrollToDataIndex(nextIndex);
        const bar = klineData[nextIndex];
        if (bar) {
          // Convert data point to pixel coordinates for precise crosshair positioning
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
        e.preventDefault();
        return;
      }

      // Up/Down: zoom in/out anchored at the right edge (通达信 style)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        if (!chart) return;
        // Get chart width to anchor zoom at right edge
        const chartEl = (chart as unknown as { getContainer?: () => HTMLElement }).getContainer?.();
        const rightX = chartEl ? chartEl.clientWidth - 60 : 800; // 60px for Y-axis area
        const scale = e.key === 'ArrowUp' ? 1.2
          : e.key === 'ArrowDown' ? 0.8
          : e.key === 'PageUp' ? 1.4
          : 0.7;
        chart.zoomAtCoordinate(scale, { x: rightX, y: 0 });
        return;
      }
      if (e.key === 'Home') { e.preventDefault(); if (chart) chart.scrollToDataIndex(0); return; }
      if (e.key === 'End') { e.preventDefault(); if (chart) chart.scrollToRealTime(); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
