import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { init, dispose, ActionType } from 'klinecharts';
import type { Chart } from 'klinecharts';
import '@/chart/perBarGrid'; // register PER_BAR_GRID indicator
import '@/chart/customYAxis'; // register manualRangeYAxis
import { manualPriceRange } from '@/chart/customYAxis';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useIndicatorStore } from '@/stores/indicatorStore';
import { useMAStore, getMACalcParams } from '@/stores/maStore';
import { toKLineData } from '@/chart/dataAdapter';
import { patchSubPixelZoom, scrollFitAll } from '@/chart/patchBarSpace';
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
    const displayDays = useChartSettingsStore((s) => s.displayDays);
    const priceScaleMode = useChartSettingsStore((s) => s.priceScaleMode);
    const priceMin = useChartSettingsStore((s) => s.priceMin);
    const priceMax = useChartSettingsStore((s) => s.priceMax);
    const activeIndicatorUpper = useIndicatorStore((s) => s.activeIndicatorUpper);
    const activeIndicatorLower = useIndicatorStore((s) => s.activeIndicatorLower);
    const maLines = useMAStore((s) => s.lines);
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

      // Allow sub-pixel barSpace for extreme zoom out (TDX-style 8000+ bars)
      patchSubPixelZoom(chart);

      // Use custom Y-axis that can inject manual min/max tick labels
      chart.setPaneOptions({ id: 'candle_pane', axisOptions: { name: 'manualRangeYAxis' } });

      // Per-bar vertical grid lines (custom indicator drawn behind candles)
      chart.createIndicator({ name: 'PER_BAR_GRID' }, false, { id: 'candle_pane' });

      // MA lines overlaid on main candle pane
      const initialMAParams = getMACalcParams(useMAStore.getState().lines);
      chart.createIndicator({ name: 'MA', calcParams: initialMAParams.length > 0 ? initialMAParams : [5, 10, 20, 60] }, false, { id: 'candle_pane' });

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
      if (!chart) return;

      if (!candles.length) {
        // Stock switched — clear chart's internal data to free memory
        chart.clearData();
        return;
      }

      chart.applyNewData(toKLineData(candles), false);

      // Set initial zoom based on displayDays setting
      const displayDays = useChartSettingsStore.getState().displayDays;
      const barsToShow = Math.min(candles.length, displayDays);
      const chartEl = (chart as unknown as { getContainer?: () => HTMLElement }).getContainer?.();
      const chartWidth = chartEl ? chartEl.clientWidth - 60 : 800;
      const barSpace = Math.max(0.01, chartWidth / barsToShow);
      chart.setBarSpace(barSpace);
      if (barSpace < 1) {
        scrollFitAll(chart);
      } else {
        chart.scrollToRealTime();
      }
    }, [candles]);

    // Re-zoom when displayDays setting changes (without reloading data)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const klineData = chart.getDataList();
      if (!klineData.length) return;

      const barsToShow = Math.min(klineData.length, displayDays);
      const chartEl = (chart as unknown as { getContainer?: () => HTMLElement }).getContainer?.();
      const chartWidth = chartEl ? chartEl.clientWidth - 60 : 800;
      const barSpace = Math.max(0.01, chartWidth / barsToShow);
      chart.setBarSpace(barSpace);
      if (barSpace < 1) {
        scrollFitAll(chart);
      } else {
        chart.scrollToRealTime();
      }
    }, [displayDays]);

    // Update upper indicator when selection or params change
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = upperPaneIdRef.current;
      if (!chart || !paneId) return;

      const calcParams = upperParams ? Object.values(upperParams) : undefined;
      const prevName = prevUpperNameRef.current;

      if (prevName === activeIndicatorUpper) {
        // Same indicator, just params changed — use overrideIndicator
        chart.overrideIndicator(
          { name: activeIndicatorUpper, ...(calcParams ? { calcParams } : {}) },
          paneId,
        );
      } else {
        // Different indicator — create new, then remove old
        chart.createIndicator(
          { name: activeIndicatorUpper, ...(calcParams ? { calcParams } : {}) },
          false,
          { id: paneId },
        );
        chart.removeIndicator(paneId, prevName);
        prevUpperNameRef.current = activeIndicatorUpper;
      }
    }, [activeIndicatorUpper, upperParams]);

    // Update lower indicator when selection or params change
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = lowerPaneIdRef.current;
      if (!chart || !paneId) return;

      const calcParams = lowerParams ? Object.values(lowerParams) : undefined;
      const prevName = prevLowerNameRef.current;

      if (prevName === activeIndicatorLower) {
        // Same indicator, just params changed — use overrideIndicator
        chart.overrideIndicator(
          { name: activeIndicatorLower, ...(calcParams ? { calcParams } : {}) },
          paneId,
        );
      } else {
        // Different indicator — create new, then remove old
        chart.createIndicator(
          { name: activeIndicatorLower, ...(calcParams ? { calcParams } : {}) },
          false,
          { id: paneId },
        );
        chart.removeIndicator(paneId, prevName);
        prevLowerNameRef.current = activeIndicatorLower;
      }
    }, [activeIndicatorLower, lowerParams]);

    // Update MA lines when maStore changes
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const calcParams = getMACalcParams(maLines);
      chart.overrideIndicator(
        { name: 'MA', calcParams: calcParams.length > 0 ? calcParams : [0] },
        'candle_pane',
      );
    }, [maLines]);

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

    // Apply Y-axis manual price range + boundary lines + lock scrolling
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = chart as any;
      const pane = c.getDrawPaneById?.('candle_pane');
      if (!pane) return;
      const yAxis = pane.getAxisComponent?.();
      if (!yAxis) return;

      // Remove previous min/max price lines
      chart.removeOverlay('__price_min_line');
      chart.removeOverlay('__price_max_line');

      if (priceScaleMode === 'manual' && priceMin != null && priceMax != null && priceMax > priceMin) {
        // Calculate tick interval using same algorithm as KLineChart (nice(range/8))
        const range = priceMax - priceMin;
        const rawInterval = range / 8;
        const exp = Math.floor(Math.log10(rawInterval));
        const exp10 = Math.pow(10, exp);
        const f = rawInterval / exp10;
        let nf: number;
        if (f < 1.5) nf = 1;
        else if (f < 2.5) nf = 2;
        else if (f < 3.5) nf = 3;
        else if (f < 4.5) nf = 4;
        else if (f < 5.5) nf = 5;
        else if (f < 6.5) nf = 6;
        else nf = 8;
        const tickInterval = nf * exp10;

        // Smart buffer: just enough to show tick labels at the edges
        // Extend so the tick nearest to min/max is inside the visible area
        const halfTick = tickInterval * 0.3;
        const displayMin = priceMin - halfTick;
        const displayMax = priceMax + halfTick;
        const displayRange = displayMax - displayMin;

        // Set global so custom Y-axis injects min/max as tick labels
        manualPriceRange.enabled = true;
        manualPriceRange.min = priceMin;
        manualPriceRange.max = priceMax;

        yAxis.setAutoCalcTickFlag(false);
        yAxis.setRange({
          from: displayMin,
          to: displayMax,
          range: displayRange,
          realFrom: displayMin,
          realTo: displayMax,
          realRange: displayRange,
        });
        c.adjustPaneViewport(false, true, true, true, true);

        // Always add price line overlays for min/max
        const klineData = chart.getDataList();
        const ts = klineData.length > 0 ? klineData[0].timestamp : Date.now();
        chart.createOverlay({
          id: '__price_max_line',
          name: 'priceLine',
          points: [{ timestamp: ts, value: priceMax }],
          styles: {
            line: { style: 'dashed' as never, dashedValue: [4, 4], size: 1, color: '#CCAA00' },
            text: { color: '#CCCCCC', size: 10, borderSize: 0, backgroundColor: 'transparent' },
          },
          lock: true,
        });
        chart.createOverlay({
          id: '__price_min_line',
          name: 'priceLine',
          points: [{ timestamp: ts, value: priceMin }],
          styles: {
            line: { style: 'dashed' as never, dashedValue: [4, 4], size: 1, color: '#CCAA00' },
            text: { color: '#CCCCCC', size: 10, borderSize: 0, backgroundColor: 'transparent' },
          },
          lock: true,
        });

        // Lock Y-axis dragging in manual mode (preserve custom axis name)
        chart.setPaneOptions({ id: 'candle_pane', axisOptions: { name: 'manualRangeYAxis', scrollZoomEnabled: false } });
      } else {
        manualPriceRange.enabled = false;
        yAxis.setAutoCalcTickFlag(true);
        c.adjustPaneViewport(false, true, true, true, true);
        // Re-enable Y-axis dragging in auto mode (preserve custom axis name)
        chart.setPaneOptions({ id: 'candle_pane', axisOptions: { name: 'manualRangeYAxis', scrollZoomEnabled: true } });
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
