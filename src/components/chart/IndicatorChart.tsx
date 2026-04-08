import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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

// ---- MACD calculation ----

interface MacdResult {
  dif: LineData<Time>[];
  dea: LineData<Time>[];
  histogram: HistogramData<Time>[];
}

function calcEMA(closes: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      ema.push(closes[i]);
    } else {
      ema.push(closes[i] * k + ema[i - 1] * (1 - k));
    }
  }
  return ema;
}

function calcMACD(
  data: OhlcvData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdResult {
  const closes = data.map((d) => d.close);
  const ema12 = calcEMA(closes, fastPeriod);
  const ema26 = calcEMA(closes, slowPeriod);

  // DIF = EMA12 - EMA26
  const difValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    difValues.push(ema12[i] - ema26[i]);
  }

  // DEA = EMA9 of DIF
  const deaValues = calcEMA(difValues, signalPeriod);

  const dif: LineData<Time>[] = [];
  const dea: LineData<Time>[] = [];
  const histogram: HistogramData<Time>[] = [];

  for (let i = 0; i < data.length; i++) {
    const time = data[i].time as Time;
    const macdVal = 2 * (difValues[i] - deaValues[i]);

    dif.push({ time, value: Math.round(difValues[i] * 1000) / 1000 });
    dea.push({ time, value: Math.round(deaValues[i] * 1000) / 1000 });
    histogram.push({
      time,
      value: Math.round(macdVal * 1000) / 1000,
      color: macdVal >= 0 ? '#FF4444' : '#00CC66',
    });
  }

  return { dif, dea, histogram };
}

// ---- component ----

export interface IndicatorChartHandle {
  chart: IChartApi | null;
}

interface IndicatorChartProps {
  candles: OhlcvData[];
}

export const IndicatorChart = forwardRef<IndicatorChartHandle, IndicatorChartProps>(
  function IndicatorChart({ candles }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const histSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const difSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const deaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useImperativeHandle(ref, () => ({ chart: chartRef.current }), []);

    // Create chart
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const chart = createChart(container, {
        ...darkChartOptions,
        autoSize: true,
        rightPriceScale: {
          borderColor: '#333333',
          scaleMargins: { top: 0.2, bottom: 0.2 },
        },
        timeScale: {
          ...darkChartOptions.timeScale,
          visible: true, // bottom chart shows the shared time axis
        },
      });

      const histSeries = chart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const difSeries = chart.addLineSeries({
        color: '#FFFFFF',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const deaSeries = chart.addLineSeries({
        color: '#FFFF00',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      chartRef.current = chart;
      histSeriesRef.current = histSeries;
      difSeriesRef.current = difSeries;
      deaSeriesRef.current = deaSeries;

      return () => {
        chart.remove();
        chartRef.current = null;
        histSeriesRef.current = null;
        difSeriesRef.current = null;
        deaSeriesRef.current = null;
      };
    }, []);

    // Update data
    useEffect(() => {
      if (!histSeriesRef.current || candles.length === 0) return;

      const { dif, dea, histogram } = calcMACD(candles, 12, 26, 9);

      histSeriesRef.current.setData(histogram);
      difSeriesRef.current?.setData(dif);
      deaSeriesRef.current?.setData(dea);
    }, [candles]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
);
