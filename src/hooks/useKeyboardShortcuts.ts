import { useEffect, useRef } from 'react';
import type { KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { useDataStore } from '@/stores/dataStore';
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
    window.addEventListener('mousemove', exitNavMode);
    window.addEventListener('click', exitNavMode);
    return () => {
      window.removeEventListener('mousemove', exitNavMode);
      window.removeEventListener('click', exitNavMode);
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
        const currentCandles = useDataStore.getState().candles;
        if (!currentCandles.length || !chart) { e.preventDefault(); return; }

        keyboardNavRef.current = true;
        const startIdx = activeBarIndex ?? currentCandles.length - 1;
        let nextIndex = startIdx;
        if (e.key === 'ArrowLeft') nextIndex = Math.max(0, startIdx - 1);
        if (e.key === 'ArrowRight') nextIndex = Math.min(currentCandles.length - 1, startIdx + 1);

        chart.scrollToDataIndex(nextIndex);
        const klineData = chart.getDataList();
        if (klineData[nextIndex]) {
          chart.executeAction('onCrosshairChange', { dataIndex: nextIndex, kLineData: klineData[nextIndex] });
        }
        useCrosshairStore.getState().setPosition({ activeBarIndex: nextIndex });
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowUp') {
        const { zoomLevel, setZoomLevel } = useChartStore.getState();
        if (zoomLevel < 2) setZoomLevel((zoomLevel + 1) as 0 | 1 | 2);
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowDown') {
        const { zoomLevel, setZoomLevel } = useChartStore.getState();
        if (zoomLevel > 0) setZoomLevel((zoomLevel - 1) as 0 | 1 | 2);
        e.preventDefault();
        return;
      }

      if (e.key === 'PageUp') { e.preventDefault(); if (chart) chart.zoomAtCoordinate(1.4); return; }
      if (e.key === 'PageDown') { e.preventDefault(); if (chart) chart.zoomAtCoordinate(0.7); return; }
      if (e.key === 'Home') { e.preventDefault(); if (chart) chart.scrollToDataIndex(0); return; }
      if (e.key === 'End') { e.preventDefault(); if (chart) chart.scrollToRealTime(); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
