import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
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
import {
  useIndicatorStore,
  INDICATOR_DEFAULTS,
  type IndicatorType,
  type IndicatorSeries,
  type IndicatorResult,
} from '@/stores/indicatorStore';
import { IndicatorParamsDialog } from './IndicatorParamsDialog';
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
  /** Which section this chart represents */
  section: 'upper' | 'lower';
  /** Whether this section is currently focused */
  focused?: boolean;
  /** Called when user clicks this section to focus it */
  onFocus?: () => void;
  formulaOverlay?: FormulaSeries[];
}

const LINE_COLORS = ['#FFFFFF', '#FFFF00', '#FF00FF', '#00FF00', '#FF8800', '#00CCFF'];

/** Format param values for header display, e.g. "(9,3,3)" */
function formatParams(indicator: string, params?: Record<string, number>): string {
  const defaults = INDICATOR_DEFAULTS[indicator];
  if (!defaults || Object.keys(defaults).length === 0) return '';
  const effective = params ?? defaults;
  const vals = Object.keys(defaults).map((k) => effective[k] ?? defaults[k]);
  return `(${vals.join(',')})`;
}

export const IndicatorChart = forwardRef<IndicatorChartHandle, IndicatorChartProps>(
  function IndicatorChart({ candles, section, focused: _focused, onFocus, formulaOverlay }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);

    // Pick indicator for this section
    const activeIndicator = useIndicatorStore((s) =>
      section === 'upper' ? s.activeIndicatorUpper : s.activeIndicatorLower,
    );
    const activeParams = useIndicatorStore((s) => s.indicatorParams[
      section === 'upper' ? s.activeIndicatorUpper : s.activeIndicatorLower
    ]);

    const chartRef = useRef<IChartApi | null>(null);
    const anchorSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const seriesRefs = useRef<ISeriesApi<'Line' | 'Histogram'>[]>([]);
    const firstHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const formulaSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
    const workerRef = useRef<Worker | null>(null);

    // Local indicator data for this section (not shared via store)
    const [localData, setLocalData] = useState<IndicatorResult | null>(null);
    const [showParamsDialog, setShowParamsDialog] = useState(false);

    // Header label text pieces: [{name, value, color}]
    const [headerParts, setHeaderParts] = useState<{ label: string; color: string }[]>([]);

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
        layout: { ...darkChartOptions.layout, textColor: '#FFFFFF', fontSize: 12 },
        timeScale: { ...darkChartOptions.timeScale, visible: true, borderColor: '#555555' },
      });

      chartRef.current = chart;

      const anchor = chart.addLineSeries({
        color: 'transparent',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      anchorSeriesRef.current = anchor;

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

    // Feed candle times to anchor series
    useEffect(() => {
      if (!candles.length || !anchorSeriesRef.current || !chartRef.current) return;
      const anchorData: LineData<Time>[] = candles.map((c) => ({
        time: c.time as Time,
        value: 0,
      }));
      anchorSeriesRef.current.setData(anchorData);
      chartRef.current.timeScale().fitContent();
    }, [candles]);

    // Render series on chart
    const renderSeries = useCallback((seriesList: IndicatorSeries[]) => {
      const chart = chartRef.current;
      if (!chart) return;

      for (const s of seriesRefs.current) {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      }
      seriesRefs.current = [];
      firstHistRef.current = null;

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
    }, []);

    // Fetch indicator data via Web Worker
    useEffect(() => {
      if (!candles.length) return;
      if (!chartRef.current) return;
      const worker = workerRef.current;
      if (!worker) return;

      const candleData = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      const handleMessage = (e: MessageEvent<WorkerMessage>) => {
        worker.removeEventListener('message', handleMessage);
        if (e.data.type === 'result') {
          setLocalData(e.data.data);
          renderSeries(e.data.data.series);
        }
      };
      worker.addEventListener('message', handleMessage);
      worker.postMessage({ candles: candleData, indicator: activeIndicator, params: activeParams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndicator, activeParams, candles, renderSeries]);

    // Build header label from localData
    useEffect(() => {
      if (!localData || !localData.series.length) {
        setHeaderParts([]);
        return;
      }
      const paramStr = formatParams(activeIndicator, activeParams);
      const parts: { label: string; color: string }[] = [
        { label: `${activeIndicator}${paramStr}`, color: '#AAAAAA' },
      ];
      let colorIdx = 0;
      for (const s of localData.series) {
        // Get the last non-NaN value
        let lastVal: number | undefined;
        for (let i = s.data.length - 1; i >= 0; i--) {
          if (s.data[i].value != null && !isNaN(s.data[i].value)) {
            lastVal = s.data[i].value;
            break;
          }
        }
        if (lastVal === undefined) continue;
        const color = s.type === 'histogram'
          ? '#888888'
          : (s.data[0]?.color ?? LINE_COLORS[colorIdx % LINE_COLORS.length]);
        if (s.type !== 'histogram') colorIdx++;
        parts.push({ label: `${s.name}: ${lastVal.toFixed(2)}`, color });
      }
      setHeaderParts(parts);
    }, [localData, activeIndicator, activeParams]);

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

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onFocus?.();
      setShowParamsDialog(true);
    };

    return (
      <div
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onClick={onFocus}
        onContextMenu={handleContextMenu}
      >
        {/* Header label overlay */}
        {headerParts.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 4,
              zIndex: 5,
              display: 'flex',
              gap: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {headerParts.map((p, i) => (
              <span key={i} style={{ color: p.color }}>{p.label}</span>
            ))}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {showParamsDialog && (
          <IndicatorParamsDialog
            indicator={activeIndicator as IndicatorType}
            onClose={() => setShowParamsDialog(false)}
          />
        )}
      </div>
    );
  }
);
