import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { OhlcvData } from '@/stores/dataStore';
import { darkChartOptions } from '@/theme/darkTheme';

// ---- helpers ----

function toVolumeData(data: OhlcvData[]): HistogramData<Time>[] {
  return data.map((d) => ({
    time: d.time as Time,
    value: d.volume,
    color: d.close >= d.open ? '#FF4444' : '#00CC66',
  }));
}

function calcVolumeMA(data: OhlcvData[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].volume;
    }
    result.push({
      time: data[i].time as Time,
      value: Math.round(sum / period),
    });
  }
  return result;
}

// ---- component ----

export interface VolumeChartHandle {
  chart: IChartApi | null;
}

interface VolumeChartProps {
  candles: OhlcvData[];
}

export const VolumeChart = forwardRef<VolumeChartHandle, VolumeChartProps>(
  function VolumeChart({ candles }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
    const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);

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
          scaleMargins: { top: 0.1, bottom: 0 },
        },
        timeScale: {
          ...darkChartOptions.timeScale,
          visible: false, // hide time axis — synced from KLine
        },
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'volume' },
      });

      const ma5 = chart.addSeries(LineSeries, {
        color: '#FFFF00',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const ma10 = chart.addSeries(LineSeries, {
        color: '#FF00FF',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      chartRef.current = chart;
      volumeSeriesRef.current = volumeSeries;
      ma5Ref.current = ma5;
      ma10Ref.current = ma10;

      return () => {
        chart.remove();
        chartRef.current = null;
        volumeSeriesRef.current = null;
        ma5Ref.current = null;
        ma10Ref.current = null;
      };
    }, []);

    // Update data
    useEffect(() => {
      if (!volumeSeriesRef.current || candles.length === 0) return;

      volumeSeriesRef.current.setData(toVolumeData(candles));
      ma5Ref.current?.setData(calcVolumeMA(candles, 5));
      ma10Ref.current?.setData(calcVolumeMA(candles, 10));
    }, [candles]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
);
