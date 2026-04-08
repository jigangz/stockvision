import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { KLineChart } from '@/components/chart/KLineChart';
import { VolumeChart, type VolumeChartHandle } from '@/components/chart/VolumeChart';
import { IndicatorChart, type IndicatorChartHandle } from '@/components/chart/IndicatorChart';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

  const klineChartRef = useRef<IChartApi | null>(null);
  const volumeRef = useRef<VolumeChartHandle>(null);
  const indicatorRef = useRef<IndicatorChartHandle>(null);

  // Fetch data on mount and when code/period changes
  useEffect(() => {
    void fetchKline(currentCode, currentMarket, currentPeriod);
  }, [currentCode, currentMarket, currentPeriod, fetchKline]);

  // Simple time-scale sync (no crosshair sync to avoid complexity)
  useEffect(() => {
    const kChart = klineChartRef.current;
    const vChart = volumeRef.current?.chart;
    const iChart = indicatorRef.current?.chart;
    if (!kChart || !vChart || !iChart) return;

    let syncing = false;
    const charts = [kChart, vChart, iChart];
    const unsubs: (() => void)[] = [];

    for (const source of charts) {
      const handler = (range: ReturnType<typeof source.timeScale>extends { getVisibleLogicalRange(): infer R } ? R : never) => {
        if (syncing || range === null) return;
        syncing = true;
        for (const target of charts) {
          if (target !== source && range) {
            target.timeScale().setVisibleLogicalRange(range);
          }
        }
        syncing = false;
      };
      source.timeScale().subscribeVisibleLogicalRangeChange(handler);
      unsubs.push(() => source.timeScale().unsubscribeVisibleLogicalRangeChange(handler));
    }

    return () => unsubs.forEach((u) => u());
  }, [candles]); // re-bind after data loads and charts are created

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#000000' }}>
      <div style={{ flex: '0 0 55%', minHeight: 0 }}>
        <KLineChart chartRef={klineChartRef} />
      </div>
      <div style={{ flex: '0 0 20%', minHeight: 0 }}>
        <VolumeChart ref={volumeRef} candles={candles} />
      </div>
      <div style={{ flex: '0 0 25%', minHeight: 0 }}>
        <IndicatorChart ref={indicatorRef} candles={candles} />
      </div>
    </div>
  );
}
