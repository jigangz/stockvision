import { useEffect, useRef, useMemo } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { KLineChart, type KLineChartHandle } from '@/components/chart/KLineChart';
import { VolumeChart, type VolumeChartHandle } from '@/components/chart/VolumeChart';
import { IndicatorChart, type IndicatorChartHandle } from '@/components/chart/IndicatorChart';
import { Crosshair } from '@/components/chart/Crosshair';
import { InfoTooltip } from '@/components/chart/InfoTooltip';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useCrosshairSync } from '@/hooks/useCrosshairSync';
import { useWheelZoom } from '@/hooks/useWheelZoom';

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

  const klineRef = useRef<KLineChartHandle>(null);
  const volumeRef = useRef<VolumeChartHandle>(null);
  const indicatorRef = useRef<IndicatorChartHandle>(null);

  // Fetch data on mount and when code/period changes
  useEffect(() => {
    void fetchKline(currentCode, currentMarket, currentPeriod);
  }, [currentCode, currentMarket, currentPeriod, fetchKline]);

  // Build chart entries for crosshair sync (memoize to avoid re-subscriptions)
  const crosshairEntries = useMemo(() => {
    if (!candles.length) return [];
    return [
      {
        key: 'kline' as const,
        chart: klineRef.current?.chart ?? null,
        series: (klineRef.current?.candleSeries ?? null) as ISeriesApi<SeriesType> | null,
      },
      {
        key: 'volume' as const,
        chart: volumeRef.current?.chart ?? null,
        series: (volumeRef.current?.volumeSeries ?? null) as ISeriesApi<SeriesType> | null,
      },
      {
        key: 'indicator' as const,
        chart: indicatorRef.current?.chart ?? null,
        series: (indicatorRef.current?.histSeries ?? null) as ISeriesApi<SeriesType> | null,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // Crosshair sync across all 3 charts
  const { handleMouseLeave } = useCrosshairSync(crosshairEntries);

  // Wheel zoom sync
  const zoomCharts = useMemo<(IChartApi | null)[]>(() => {
    if (!candles.length) return [];
    return [
      klineRef.current?.chart ?? null,
      volumeRef.current?.chart ?? null,
      indicatorRef.current?.chart ?? null,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  useWheelZoom({ charts: zoomCharts, minBars: 20, maxBars: 500 });

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const { activeBarIndex } = useCrosshairStore.getState();
      const currentCandles = useDataStore.getState().candles;
      if (activeBarIndex === null || !currentCandles.length) return;

      let nextIndex = activeBarIndex;
      if (e.key === 'ArrowLeft') nextIndex = Math.max(0, activeBarIndex - 1);
      if (e.key === 'ArrowRight')
        nextIndex = Math.min(currentCandles.length - 1, activeBarIndex + 1);

      if (nextIndex !== activeBarIndex) {
        const kChart = klineRef.current?.chart;
        const kSeries = klineRef.current?.candleSeries;
        if (kChart && kSeries) {
          const bar = currentCandles[nextIndex];
          try {
            kChart.setCrosshairPosition(
              bar.close,
              bar.time as Parameters<typeof kChart.setCrosshairPosition>[1],
              kSeries,
            );
          } catch {
            // fallback: just update the store
          }
          useCrosshairStore.getState().setPosition({ activeBarIndex: nextIndex });
        }
      }

      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const chartAreaStyle = (flex: string): React.CSSProperties => ({
    flex,
    minHeight: 0,
    position: 'relative',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#000000',
      }}
      onMouseLeave={handleMouseLeave}
    >
      {/* K-Line area */}
      <div style={chartAreaStyle('0 0 55%')}>
        <KLineChart ref={klineRef} />
        <Crosshair chartArea="kline" />
        <InfoTooltip />
      </div>

      {/* Volume area */}
      <div style={chartAreaStyle('0 0 20%')}>
        <VolumeChart ref={volumeRef} candles={candles} />
        <Crosshair chartArea="volume" />
      </div>

      {/* Indicator (MACD) area */}
      <div style={chartAreaStyle('0 0 25%')}>
        <IndicatorChart ref={indicatorRef} candles={candles} />
        <Crosshair chartArea="indicator" />
      </div>
    </div>
  );
}
