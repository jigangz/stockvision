import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { init, dispose } from 'klinecharts';
import type { Chart } from 'klinecharts';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useIndicatorStore } from '@/stores/indicatorStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { toKLineData } from '@/chart/dataAdapter';
import { darkStyles } from '@/theme/klineTheme';

export interface KLineChartWrapperHandle {
  chart: Chart | null;
  upperPaneId: string | null;
  lowerPaneId: string | null;
}

export const KLineChartWrapper = forwardRef<KLineChartWrapperHandle>(
  function KLineChartWrapper(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const upperPaneIdRef = useRef<string | null>(null);
    const lowerPaneIdRef = useRef<string | null>(null);

    // Latest candles ref for DataLoader closure
    const candlesRef = useRef(useDataStore.getState().candles);
    // Guard: skip candles useEffect re-render during lazy load to avoid chart reset mid-scroll
    const isLazyLoadingRef = useRef(false);

    const candles = useDataStore((s) => s.candles);
    const zoomLevel = useChartStore((s) => s.zoomLevel);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const activeIndicatorUpper = useIndicatorStore((s) => s.activeIndicatorUpper);
    const activeIndicatorLower = useIndicatorStore((s) => s.activeIndicatorLower);
    const upperParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorUpper]);
    const lowerParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorLower]);

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get upperPaneId() { return upperPaneIdRef.current; },
      get lowerPaneId() { return lowerPaneIdRef.current; },
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

      // MA lines on main pane
      chart.createIndicator({ name: 'MA', calcParams: [5, 10, 20, 60] }, false);

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

      // Subscribe crosshair changes → crosshairStore
      chart.subscribeAction('onCrosshairChange', (data) => {
        const ch = data as { dataIndex?: number };
        if (ch?.dataIndex != null) {
          useCrosshairStore.getState().setPosition({ activeBarIndex: ch.dataIndex });
        }
      });

      // Initial data load via DataLoader
      chart.setSymbol({ ticker: 'stock', pricePrecision: 2, volumePrecision: 0 });
      chart.setPeriod({ type: 'day', span: 1 });
      chart.setDataLoader({
        getBars: async ({ type, callback }) => {
          const store = useDataStore.getState();
          if (type === 'backward') {
            if (store.allLoaded || store.loadingMore) {
              callback([], false);
              return;
            }
            isLazyLoadingRef.current = true;
            try {
              const prevCount = store.candles.length;
              await store.fetchMoreBars();
              const next = useDataStore.getState();
              const addedCount = next.candles.length - prevCount;
              const olderBars = addedCount > 0 ? toKLineData(next.candles.slice(0, addedCount)) : [];
              callback(olderBars, { backward: !next.allLoaded });
            } finally {
              isLazyLoadingRef.current = false;
            }
          } else {
            callback(toKLineData(candlesRef.current), { backward: !store.allLoaded });
          }
        },
      });

      return () => {
        dispose(el);
        chartRef.current = null;
        upperPaneIdRef.current = null;
        lowerPaneIdRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update candles ref and reload chart when candles change (new stock selected)
    useEffect(() => {
      candlesRef.current = candles;
      if (isLazyLoadingRef.current) return;
      const chart = chartRef.current;
      if (!chart || !candles.length) return;

      // Re-trigger DataLoader by resetting the symbol — this causes getBars to be
      // called again with type='init', which will read the latest candlesRef.current
      chart.setSymbol({ ticker: 'stock', pricePrecision: 2, volumePrecision: 0 });
    }, [candles]);

    // Update upper indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = upperPaneIdRef.current;
      if (!chart || !paneId) return;

      // Remove all indicators from this pane, then add the new one into the SAME pane
      chart.removeIndicator({ paneId });
      const calcParams = upperParams ? Object.values(upperParams) : undefined;
      // Use isStack=false with existing paneId to reuse the pane (not create a new one)
      chart.createIndicator(
        { name: activeIndicatorUpper, ...(calcParams ? { calcParams } : {}) },
        false,
        { id: paneId },
      );
    }, [activeIndicatorUpper, upperParams]);

    // Update lower indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = lowerPaneIdRef.current;
      if (!chart || !paneId) return;

      chart.removeIndicator({ paneId });
      const calcParams = lowerParams ? Object.values(lowerParams) : undefined;
      chart.createIndicator(
        { name: activeIndicatorLower, ...(calcParams ? { calcParams } : {}) },
        false,
        { id: paneId },
      );
    }, [activeIndicatorLower, lowerParams]);

    // Handle zoom level — minimize/restore indicator panes
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const upperPaneId = upperPaneIdRef.current;
      const lowerPaneId = lowerPaneIdRef.current;

      if (zoomLevel >= 2) {
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, state: 'minimize' });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, state: 'minimize' });
      } else {
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, state: 'normal', height: 100 });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, state: 'normal', height: 100 });
      }
    }, [zoomLevel]);

    // Apply right offset
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      // KLineChart uses pixel distance; approximate bar width ~8px
      chart.scrollByDistance(0); // no-op to ensure chart is ready
    }, [rightOffset]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  },
);
