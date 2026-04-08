import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { OhlcvData } from '@/stores/dataStore';
import { useIndicatorStore, type IndicatorSeries } from '@/stores/indicatorStore';
import { darkChartOptions } from '@/theme/darkTheme';

type WorkerMessage =
  | { type: 'result'; data: { indicator: string; series: IndicatorSeries[] } }
  | { type: 'error'; message: string };

export interface IndicatorChartHandle {
  chart: IChartApi | null;
  histSeries: ISeriesApi<'Histogram'> | null;
}

export interface FormulaSeries {
  name: string;
  data: { time: number; value: number }[];
}

interface IndicatorChartProps {
  candles: OhlcvData[];
  formulaOverlay?: FormulaSeries[];
}

const LINE_COLORS = ['#FFFFFF', '#FFFF00', '#FF00FF', '#00FF00', '#FF8800', '#00CCFF'];

export const IndicatorChart = forwardRef<IndicatorChartHandle, IndicatorChartProps>(
  function IndicatorChart({ candles, formulaOverlay }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const activeIndicator = useIndicatorStore((s) => s.activeIndicator);
    const setIndicatorData = useIndicatorStore((s) => s.setIndicatorData);
    const setLoading = useIndicatorStore((s) => s.setLoading);
    const setError = useIndicatorStore((s) => s.setError);

    const chartRef = useRef<IChartApi | null>(null);
    // Dynamic series: array of line/histogram series instances
    const seriesRefs = useRef<ISeriesApi<'Line' | 'Histogram'>[]>([]);
    // First histogram series for handle (crosshair compat)
    const firstHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    // Formula overlay series
    const formulaSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
    // Web Worker for off-main-thread indicator calculations
    const workerRef = useRef<Worker | null>(null);

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get histSeries() { return firstHistRef.current; },
    }));

    // Create chart once + spawn Web Worker
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = createChart(el, {
        ...darkChartOptions,
        autoSize: true,
        rightPriceScale: { borderColor: '#333333', scaleMargins: { top: 0.2, bottom: 0.2 } },
        timeScale: { ...darkChartOptions.timeScale, visible: true },
      });

      chartRef.current = chart;

      // Spawn indicator worker
      workerRef.current = new Worker(
        new URL('../../workers/indicator.worker.ts', import.meta.url),
        { type: 'module' },
      );

      return () => {
        chart.remove();
        chartRef.current = null;
        seriesRefs.current = [];
        firstHistRef.current = null;
        workerRef.current?.terminate();
        workerRef.current = null;
      };
    }, []);

    // Fetch indicator data via Web Worker when indicator or candles change
    useEffect(() => {
      if (!candles.length) return;
      if (!chartRef.current) return;
      const worker = workerRef.current;
      if (!worker) return;

      setLoading(true);
      setError(null);

      const candleData = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      // One-shot message handler for this request
      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        worker.removeEventListener('message', handleMessage);
        if (e.data.type === 'result') {
          setIndicatorData(e.data.data);
          setLoading(false);
          renderSeries(e.data.data.series);
        } else {
          setError(e.data.message);
          setLoading(false);
        }
      };
      worker.addEventListener('message', handleMessage);
      worker.postMessage({ candles: candleData, indicator: activeIndicator });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndicator, candles]);

    function renderSeries(seriesList: IndicatorSeries[]) {
      const chart = chartRef.current;
      if (!chart) return;

      // Remove old series
      for (const s of seriesRefs.current) {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      }
      seriesRefs.current = [];
      firstHistRef.current = null;

      // Add new series
      let colorIdx = 0;
      for (const s of seriesList) {
        if (s.type === 'histogram') {
          const hist = chart.addHistogramSeries({
            priceLineVisible: false,
            lastValueVisible: false,
          });
          const histData = s.data.map((d) => ({
            time: d.time as Time,
            value: d.value,
            color: d.color ?? '#888888',
          })) as HistogramData<Time>[];
          hist.setData(histData);
          seriesRefs.current.push(hist);
          if (!firstHistRef.current) firstHistRef.current = hist;
        } else {
          const color = s.data[0]?.color ?? LINE_COLORS[colorIdx % LINE_COLORS.length];
          colorIdx++;
          const line = chart.addLineSeries({
            color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          const lineData = s.data.map((d) => ({
            time: d.time as Time,
            value: d.value,
          })) as LineData<Time>[];
          line.setData(lineData);
          seriesRefs.current.push(line);
        }
      }
    }

    // Apply rightOffset
    useEffect(() => {
      if (!chartRef.current) return;
      chartRef.current.applyOptions({ timeScale: { rightOffset } });
    }, [rightOffset]);

    // Render formula overlay series
    const FORMULA_COLORS = ['#FF8800', '#00CCFF', '#FF00FF', '#FFFF00', '#AAAAFF'];
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      // Remove old formula series
      for (const s of formulaSeriesRefs.current) {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      }
      formulaSeriesRefs.current = [];
      if (!formulaOverlay || formulaOverlay.length === 0) return;
      formulaOverlay.forEach((fs, idx) => {
        const line = chart.addLineSeries({
          color: FORMULA_COLORS[idx % FORMULA_COLORS.length],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: fs.name,
        });
        line.setData(fs.data.map((d) => ({ time: d.time as Time, value: d.value })) as LineData<Time>[]);
        formulaSeriesRefs.current.push(line);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formulaOverlay]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }
);
