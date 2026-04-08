import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { KLineChart } from '@/components/chart/KLineChart';
import { VolumeChart, type VolumeChartHandle } from '@/components/chart/VolumeChart';
import { IndicatorChart, type IndicatorChartHandle } from '@/components/chart/IndicatorChart';
import { useChartSync } from '@/hooks/useChartSync';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  background: '#000000',
};

const klineStyle: React.CSSProperties = { flex: '0 0 55%', minHeight: 0 };
const volumeStyle: React.CSSProperties = { flex: '0 0 20%', minHeight: 0 };
const indicatorStyle: React.CSSProperties = { flex: '0 0 25%', minHeight: 0 };

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

  // Chart refs for sync
  const klineChartRef = useRef<IChartApi | null>(null);
  const volumeHandleRef = useRef<VolumeChartHandle>(null);
  const indicatorHandleRef = useRef<IndicatorChartHandle>(null);

  // Wrapper refs that always point to the inner IChartApi
  const volumeChartRef = useRef<IChartApi | null>(null);
  const indicatorChartRef = useRef<IChartApi | null>(null);

  // Keep wrapper refs in sync with handles
  useEffect(() => {
    volumeChartRef.current = volumeHandleRef.current?.chart ?? null;
    indicatorChartRef.current = indicatorHandleRef.current?.chart ?? null;
  });

  useChartSync([klineChartRef, volumeChartRef, indicatorChartRef]);

  // Fetch data on mount and when code/period changes
  useEffect(() => {
    void fetchKline(currentCode, currentMarket, currentPeriod);
  }, [currentCode, currentMarket, currentPeriod, fetchKline]);

  return (
    <div style={containerStyle}>
      <div style={klineStyle}>
        <KLineChart chartRef={klineChartRef} />
      </div>
      <div style={volumeStyle}>
        <VolumeChart ref={volumeHandleRef} candles={candles} />
      </div>
      <div style={indicatorStyle}>
        <IndicatorChart ref={indicatorHandleRef} candles={candles} />
      </div>
    </div>
  );
}
