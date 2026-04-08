import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { useDataStore, type OhlcvData } from '@/stores/dataStore';
import { darkChartOptions, candleColors, maColors } from '@/theme/darkTheme';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';

export interface KLineChartHandle {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
}

function calcMA(data: OhlcvData[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push({
      time: data[i].time as Time,
      value: Math.round((sum / period) * 100) / 100,
    });
  }
  return result;
}

function toCandlestickData(data: OhlcvData[]): CandlestickData<Time>[] {
  return data.map((d) => ({
    time: d.time as Time,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }));
}

export const KLineChart = forwardRef<KLineChartHandle>(
  function KLineChart(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const internals = useRef<{
      chart: IChartApi;
      candle: ISeriesApi<'Candlestick'>;
      ma5: ISeriesApi<'Line'>;
      ma10: ISeriesApi<'Line'>;
      ma20: ISeriesApi<'Line'>;
      ma60: ISeriesApi<'Line'>;
    } | null>(null);

    const candles = useDataStore((s) => s.candles);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const priceScaleMode = useChartSettingsStore((s) => s.priceScaleMode);
    const priceMin = useChartSettingsStore((s) => s.priceMin);
    const priceMax = useChartSettingsStore((s) => s.priceMax);

    useImperativeHandle(ref, () => ({
      get chart() {
        return internals.current?.chart ?? null;
      },
      get candleSeries() {
        return internals.current?.candle ?? null;
      },
    }));

    // Create chart
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = createChart(el, {
        ...darkChartOptions,
        autoSize: true,
        timeScale: { ...darkChartOptions.timeScale, visible: false },
      });

      const candle = chart.addCandlestickSeries({
        upColor: candleColors.upColor,
        downColor: candleColors.downColor,
        wickUpColor: candleColors.wickUpColor,
        wickDownColor: candleColors.wickDownColor,
        borderVisible: false,
      });

      const ma5 = chart.addLineSeries({ color: maColors.ma5, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma10 = chart.addLineSeries({ color: maColors.ma10, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma20 = chart.addLineSeries({ color: maColors.ma20, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma60 = chart.addLineSeries({ color: maColors.ma60, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

      internals.current = { chart, candle, ma5, ma10, ma20, ma60 };

      return () => {
        chart.remove();
        internals.current = null;
      };
    }, []);

    // Update data
    useEffect(() => {
      const api = internals.current;
      if (!api || candles.length === 0) return;

      api.candle.setData(toCandlestickData(candles));
      api.ma5.setData(calcMA(candles, 5));
      api.ma10.setData(calcMA(candles, 10));
      api.ma20.setData(calcMA(candles, 20));
      api.ma60.setData(calcMA(candles, 60));
      api.chart.timeScale().fitContent();
    }, [candles]);

    // Apply rightOffset when it changes
    useEffect(() => {
      const api = internals.current;
      if (!api) return;
      api.chart.applyOptions({ timeScale: { rightOffset } });
    }, [rightOffset]);

    // Apply price scale range when settings change
    useEffect(() => {
      const api = internals.current;
      if (!api) return;
      if (priceScaleMode === 'manual' && priceMin != null && priceMax != null) {
        api.candle.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: priceMin, maxValue: priceMax },
            margins: { above: 0.05, below: 0.05 },
          }),
        });
      } else {
        api.candle.applyOptions({ autoscaleInfoProvider: undefined });
      }
    }, [priceScaleMode, priceMin, priceMax]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  },
);
