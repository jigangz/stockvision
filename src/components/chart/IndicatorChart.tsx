import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { OhlcvData } from '@/stores/dataStore';
import { darkChartOptions } from '@/theme/darkTheme';

function calcEMA(closes: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < closes.length; i++) {
    ema.push(i === 0 ? closes[i] : closes[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcMACD(data: OhlcvData[]) {
  const closes = data.map((d) => d.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const difValues = ema12.map((v, i) => v - ema26[i]);
  const deaValues = calcEMA(difValues, 9);

  const dif: LineData<Time>[] = [];
  const dea: LineData<Time>[] = [];
  const histogram: HistogramData<Time>[] = [];

  for (let i = 0; i < data.length; i++) {
    const time = data[i].time as Time;
    const macdVal = 2 * (difValues[i] - deaValues[i]);
    dif.push({ time, value: Math.round(difValues[i] * 1000) / 1000 });
    dea.push({ time, value: Math.round(deaValues[i] * 1000) / 1000 });
    histogram.push({ time, value: Math.round(macdVal * 1000) / 1000, color: macdVal >= 0 ? '#FF4444' : '#00CC66' });
  }
  return { dif, dea, histogram };
}

export interface IndicatorChartHandle {
  chart: IChartApi | null;
}

interface IndicatorChartProps {
  candles: OhlcvData[];
}

export const IndicatorChart = forwardRef<IndicatorChartHandle, IndicatorChartProps>(
  function IndicatorChart({ candles }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const internals = useRef<{
      chart: IChartApi;
      hist: ISeriesApi<'Histogram'>;
      dif: ISeriesApi<'Line'>;
      dea: ISeriesApi<'Line'>;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      get chart() { return internals.current?.chart ?? null; }
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = createChart(el, {
        ...darkChartOptions,
        autoSize: true,
        rightPriceScale: { borderColor: '#333333', scaleMargins: { top: 0.2, bottom: 0.2 } },
        timeScale: { ...darkChartOptions.timeScale, visible: true },
      });

      const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      const difLine = chart.addLineSeries({ color: '#FFFFFF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const deaLine = chart.addLineSeries({ color: '#FFFF00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

      internals.current = { chart, hist, dif: difLine, dea: deaLine };

      return () => {
        chart.remove();
        internals.current = null;
      };
    }, []);

    useEffect(() => {
      const api = internals.current;
      if (!api || candles.length === 0) return;
      const { dif, dea, histogram } = calcMACD(candles);
      api.hist.setData(histogram);
      api.dif.setData(dif);
      api.dea.setData(dea);
    }, [candles]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }
);
