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
import { useChartSettingsStore } from '@/stores/chartSettingsStore';

function toVolumeData(data: OhlcvData[]): HistogramData<Time>[] {
  return data.map((d) => ({
    time: d.time as Time,
    value: d.volume,
    color: d.close >= d.open ? '#FF4444' : '#00CC66',
  }));
}

function calcVolumeMA(data: OhlcvData[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].volume;
    result.push({ time: data[i].time as Time, value: Math.round(sum / period) });
  }
  return result;
}

export interface VolumeChartHandle {
  chart: IChartApi | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
}

interface VolumeChartProps {
  candles: OhlcvData[];
}

export const VolumeChart = forwardRef<VolumeChartHandle, VolumeChartProps>(
  function VolumeChart({ candles }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const internals = useRef<{
      chart: IChartApi;
      volume: ISeriesApi<'Histogram'>;
      ma5: ISeriesApi<'Line'>;
      ma10: ISeriesApi<'Line'>;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      get chart() { return internals.current?.chart ?? null; },
      get volumeSeries() { return internals.current?.volume ?? null; },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = createChart(el, {
        ...darkChartOptions,
        autoSize: true,
        rightPriceScale: { borderColor: '#333333', scaleMargins: { top: 0.1, bottom: 0 } },
        timeScale: { ...darkChartOptions.timeScale, visible: false },
      });

      const volume = chart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'volume' },
      });
      const ma5 = chart.addLineSeries({ color: '#FFFF00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma10 = chart.addLineSeries({ color: '#FF00FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

      internals.current = { chart, volume, ma5, ma10 };

      return () => {
        chart.remove();
        internals.current = null;
      };
    }, []);

    useEffect(() => {
      const api = internals.current;
      if (!api || candles.length === 0) return;
      api.volume.setData(toVolumeData(candles));
      api.ma5.setData(calcVolumeMA(candles, 5));
      api.ma10.setData(calcVolumeMA(candles, 10));
    }, [candles]);

    useEffect(() => {
      const api = internals.current;
      if (!api) return;
      api.chart.applyOptions({ timeScale: { rightOffset } });
    }, [rightOffset]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }
);
