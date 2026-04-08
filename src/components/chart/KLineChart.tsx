import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
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

interface KLineChartProps {
  width?: number;
  height?: number;
  /** Optional external ref to expose IChartApi for chart sync */
  chartRef?: MutableRefObject<IChartApi | null>;
}

function calcMA(data: OhlcvData[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
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

export function KLineChart({ width, height, chartRef: externalChartRef }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const candles = useDataStore((s) => s.candles);

  // Create chart on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      ...darkChartOptions,
      width: width ?? container.clientWidth,
      height: height ?? container.clientHeight,
      autoSize: !width && !height,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: candleColors.upColor,
      downColor: candleColors.downColor,
      wickUpColor: candleColors.wickUpColor,
      wickDownColor: candleColors.wickDownColor,
      borderVisible: false,
    });

    const ma5 = chart.addLineSeries({
      color: maColors.ma5,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma10 = chart.addLineSeries({
      color: maColors.ma10,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma20 = chart.addLineSeries({
      color: maColors.ma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma60 = chart.addLineSeries({
      color: maColors.ma60,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    if (externalChartRef) externalChartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ma5Ref.current = ma5;
    ma10Ref.current = ma10;
    ma20Ref.current = ma20;
    ma60Ref.current = ma60;

    return () => {
      chart.remove();
      chartRef.current = null;
      if (externalChartRef) externalChartRef.current = null;
      candleSeriesRef.current = null;
      ma5Ref.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
      ma60Ref.current = null;
    };
  }, [width, height, externalChartRef]);

  // Update data when candles change
  const updateData = useCallback((data: OhlcvData[]) => {
    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(toCandlestickData(data));
    ma5Ref.current?.setData(calcMA(data, 5));
    ma10Ref.current?.setData(calcMA(data, 10));
    ma20Ref.current?.setData(calcMA(data, 20));
    ma60Ref.current?.setData(calcMA(data, 60));

    if (data.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, []);

  useEffect(() => {
    updateData(candles);
  }, [candles, updateData]);

  // Handle resize when no explicit dimensions
  useEffect(() => {
    if (width || height) return;

    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        chart.applyOptions({ width: w, height: h });
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%',
      }}
    />
  );
}
