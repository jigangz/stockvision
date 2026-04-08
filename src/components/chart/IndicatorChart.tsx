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

export interface IndicatorChartHandle {
  chart: IChartApi | null;
  histSeries: ISeriesApi<'Histogram'> | null;
}

interface IndicatorChartProps {
  candles: OhlcvData[];
}

const LINE_COLORS = ['#FFFFFF', '#FFFF00', '#FF00FF', '#00FF00', '#FF8800', '#00CCFF'];

export const IndicatorChart = forwardRef<IndicatorChartHandle, IndicatorChartProps>(
  function IndicatorChart({ candles }, ref) {
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

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get histSeries() { return firstHistRef.current; },
    }));

    // Create chart once
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

      return () => {
        chart.remove();
        chartRef.current = null;
        seriesRefs.current = [];
        firstHistRef.current = null;
      };
    }, []);

    // Fetch indicator data when indicator or candles change
    useEffect(() => {
      if (!candles.length) return;
      if (!chartRef.current) return;

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

      fetch('http://localhost:8899/api/indicators/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: candleData, indicator: activeIndicator }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<{ indicator: string; series: IndicatorSeries[] }>;
        })
        .then((result) => {
          setIndicatorData(result);
          setLoading(false);
          renderSeries(result.series);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setLoading(false);
        });
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

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }
);
