import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { init, dispose, ActionType } from 'klinecharts';
import type { Chart } from 'klinecharts';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useIndicatorStore } from '@/stores/indicatorStore';
import { toKLineData } from '@/chart/dataAdapter';
import { darkStyles } from '@/theme/klineTheme';

export interface KLineChartWrapperHandle {
  chart: Chart | null;
  upperPaneId: string | null;
  lowerPaneId: string | null;
  /** The paneId the crosshair is currently hovering over */
  lastCrosshairPaneId: string | null;
  /** The dataIndex the mouse crosshair is currently hovering over */
  lastHoveredDataIndex: number | null;
}

export const KLineChartWrapper = forwardRef<KLineChartWrapperHandle>(
  function KLineChartWrapper(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const upperPaneIdRef = useRef<string | null>(null);
    const lowerPaneIdRef = useRef<string | null>(null);
    const lastCrosshairPaneIdRef = useRef<string | null>(null);
    const lastHoveredDataIndexRef = useRef<number | null>(null);
    const prevUpperNameRef = useRef<string>('VOL');
    const prevLowerNameRef = useRef<string>('MACD');

    const candles = useDataStore((s) => s.candles);
    const zoomLevel = useChartStore((s) => s.zoomLevel);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const priceScaleMode = useChartSettingsStore((s) => s.priceScaleMode);
    const priceMin = useChartSettingsStore((s) => s.priceMin);
    const priceMax = useChartSettingsStore((s) => s.priceMax);
    const activeIndicatorUpper = useIndicatorStore((s) => s.activeIndicatorUpper);
    const activeIndicatorLower = useIndicatorStore((s) => s.activeIndicatorLower);
    const upperParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorUpper]);
    const lowerParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorLower]);

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get upperPaneId() { return upperPaneIdRef.current; },
      get lowerPaneId() { return lowerPaneIdRef.current; },
      get lastCrosshairPaneId() { return lastCrosshairPaneIdRef.current; },
      get lastHoveredDataIndex() { return lastHoveredDataIndexRef.current; },
    }));

    // Initialize chart once
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = init(el, {
        locale: 'zh-CN',
        styles: darkStyles as never,
      });
      if (!chart) return;
      chartRef.current = chart;

      // MA lines overlaid on main candle pane
      chart.createIndicator({ name: 'MA', calcParams: [5, 10, 20, 60] }, false, { id: 'candle_pane' });

      // Upper indicator pane (VOL default)
      const upperPaneId = chart.createIndicator('VOL', true, {
        height: 100,
        dragEnabled: true,
      });
      upperPaneIdRef.current = upperPaneId;

      // Lower indicator pane (MACD default)
      const lowerPaneId = chart.createIndicator('MACD', true, {
        height: 100,
        dragEnabled: true,
      });
      lowerPaneIdRef.current = lowerPaneId;

      // Subscribe crosshair changes → track paneId & hovered index in refs
      // (Don't write to crosshairStore here — only keyboard nav & click do that)
      chart.subscribeAction(ActionType.OnCrosshairChange, (data) => {
        const ch = data as { dataIndex?: number; paneId?: string };
        if (ch?.paneId) {
          lastCrosshairPaneIdRef.current = ch.paneId;
        }
        if (ch?.dataIndex != null) {
          lastHoveredDataIndexRef.current = ch.dataIndex;
        }
      });

      // v9: Register lazy loading callback for scrolling left
      chart.loadMore((_timestamp) => {
        const store = useDataStore.getState();
        if (store.allLoaded || store.loadingMore) return;

        const prevCount = store.candles.length;
        void store.fetchMoreBars().then(() => {
          const next = useDataStore.getState();
          const addedCount = next.candles.length - prevCount;
          if (addedCount > 0) {
            const olderBars = toKLineData(next.candles.slice(0, addedCount));
            chart.applyMoreData(olderBars, !next.allLoaded);
          }
        });
      });

      // Resize chart when container size changes (e.g. window maximize)
      const ro = new ResizeObserver(() => {
        chartRef.current?.resize();
      });
      ro.observe(el);

      return () => {
        ro.disconnect();
        dispose(el);
        chartRef.current = null;
        upperPaneIdRef.current = null;
        lowerPaneIdRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // v9: Push data directly when candles change
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !candles.length) return;

      const store = useDataStore.getState();
      chart.applyNewData(toKLineData(candles), !store.allLoaded);
    }, [candles]);

    // Update upper indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = upperPaneIdRef.current;
      if (!chart || !paneId) return;

      const calcParams = upperParams ? Object.values(upperParams) : undefined;
      const prevName = prevUpperNameRef.current;

      // Create new indicator first so the pane is never empty (prevents pane destruction)
      chart.createIndicator(
        { name: activeIndicatorUpper, ...(calcParams ? { calcParams } : {}) },
        false,
        { id: paneId },
      );
      // Remove old indicator by name (pane survives because new one exists)
      if (prevName !== activeIndicatorUpper) {
        chart.removeIndicator(paneId, prevName);
      }
      prevUpperNameRef.current = activeIndicatorUpper;
    }, [activeIndicatorUpper, upperParams]);

    // Update lower indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = lowerPaneIdRef.current;
      if (!chart || !paneId) return;

      const calcParams = lowerParams ? Object.values(lowerParams) : undefined;
      const prevName = prevLowerNameRef.current;

      chart.createIndicator(
        { name: activeIndicatorLower, ...(calcParams ? { calcParams } : {}) },
        false,
        { id: paneId },
      );
      if (prevName !== activeIndicatorLower) {
        chart.removeIndicator(paneId, prevName);
      }
      prevLowerNameRef.current = activeIndicatorLower;
    }, [activeIndicatorLower, lowerParams]);

    // Handle zoom level — minimize/restore indicator panes (v9 uses height trick)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const upperPaneId = upperPaneIdRef.current;
      const lowerPaneId = lowerPaneIdRef.current;

      if (zoomLevel >= 2) {
        // v9: minimize by setting very small height
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, height: 0, minHeight: 0 });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, height: 0, minHeight: 0 });
      } else {
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, height: 100, minHeight: 30 });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, height: 100, minHeight: 30 });
      }
    }, [zoomLevel]);

    // Apply Y-axis manual price range
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = chart as any;
      const pane = c.getDrawPaneById?.('candle_pane');
      if (!pane) return;
      const yAxis = pane.getAxisComponent?.();
      if (!yAxis) return;

      if (priceScaleMode === 'manual' && priceMin != null && priceMax != null && priceMax > priceMin) {
        yAxis.setAutoCalcTickFlag(false);
        yAxis.setRange({
          from: priceMin,
          to: priceMax,
          range: priceMax - priceMin,
          realFrom: priceMin,
          realTo: priceMax,
          realRange: priceMax - priceMin,
        });
        c.adjustPaneViewport(false, true, true, true, true);
      } else {
        yAxis.setAutoCalcTickFlag(true);
        c.adjustPaneViewport(false, true, true, true, true);
      }
    }, [priceScaleMode, priceMin, priceMax, candles]);

    // Apply right offset
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.setOffsetRightDistance(rightOffset * 8);
    }, [rightOffset]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  },
);
