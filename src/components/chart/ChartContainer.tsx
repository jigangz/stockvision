import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
// DrawingCanvas chart/series refs are derived from candles to ensure charts are mounted
import { KLineChart, type KLineChartHandle } from '@/components/chart/KLineChart';
import { VolumeChart, type VolumeChartHandle } from '@/components/chart/VolumeChart';
import { IndicatorChart, type IndicatorChartHandle } from '@/components/chart/IndicatorChart';
import { Crosshair } from '@/components/chart/Crosshair';
import { InfoTooltip } from '@/components/chart/InfoTooltip';
import { ChartSettingsDialog } from '@/components/chart/ChartSettingsDialog';
import { PriceScaleDialog } from '@/components/chart/PriceScaleDialog';
import { DrawingCanvas } from '@/components/chart/DrawingCanvas';
import { DrawingToolbar } from '@/components/chart/DrawingToolbar';
import { IndicatorTabBar } from '@/components/chart/IndicatorTabBar';
import { IntervalStatsDialog } from '@/components/chart/IntervalStatsDialog';
import { FormulaEditor } from '@/components/chart/FormulaEditor';
import { StockScreener } from '@/components/chart/StockScreener';
import { SectorHeatmap } from '@/components/chart/SectorHeatmap';
import { CapitalFlowDialog } from '@/components/chart/CapitalFlowDialog';
import { DataSourceSettings } from '@/components/chart/DataSourceSettings';
import type { FormulaSeries } from '@/components/chart/IndicatorChart';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { useCrosshairSync } from '@/hooks/useCrosshairSync';
import { useWheelZoom } from '@/hooks/useWheelZoom';

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);
  const displayDays = useChartSettingsStore((s) => s.displayDays);
  const setRightOffset = useChartSettingsStore((s) => s.setRightOffset);
  const saveSettings = useChartSettingsStore((s) => s.saveSettings);
  const fetchSettings = useChartSettingsStore((s) => s.fetchSettings);
  const loadDrawings = useDrawingStore((s) => s.loadDrawings);

  const [showSettings, setShowSettings] = useState(false);
  const [showPriceScale, setShowPriceScale] = useState(false);
  const [showIntervalStats, setShowIntervalStats] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCapitalFlow, setShowCapitalFlow] = useState(false);
  const [showDataSource, setShowDataSource] = useState(false);
  const [formulaOverlay, setFormulaOverlay] = useState<FormulaSeries[]>([]);
  const [drawingChart, setDrawingChart] = useState<IChartApi | null>(null);
  const [drawingSeries, setDrawingSeries] = useState<ISeriesApi<SeriesType> | null>(null);

  const klineRef = useRef<KLineChartHandle>(null);
  const volumeRef = useRef<VolumeChartHandle>(null);
  const indicatorRef = useRef<IndicatorChartHandle>(null);

  // Load persisted settings on mount
  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Compute start date from displayDays
  const getStartDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - displayDays);
    return d.toISOString().slice(0, 10);
  }, [displayDays]);

  // Fetch data on mount and when code/period/displayDays changes
  useEffect(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKline(currentCode, currentMarket, currentPeriod, start, end);
  }, [currentCode, currentMarket, currentPeriod, displayDays, fetchKline, getStartDate]);

  // Auto-load drawings when stock or period changes
  useEffect(() => {
    void loadDrawings(currentCode, currentPeriod);
  }, [currentCode, currentPeriod, loadDrawings]);

  // Track rightOffset from timeScale drag and save to store (debounced)
  const rightOffsetSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const kChart = klineRef.current?.chart;
    if (!kChart || !candles.length) return;

    const handler = () => {
      const range = kChart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const newRightOffset = Math.max(0, Math.round(range.to - (candles.length - 1)));
      setRightOffset(newRightOffset);
      if (rightOffsetSaveTimer.current) clearTimeout(rightOffsetSaveTimer.current);
      rightOffsetSaveTimer.current = setTimeout(() => {
        void saveSettings({ rightOffset: newRightOffset });
      }, 1000);
    };

    kChart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      kChart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      if (rightOffsetSaveTimer.current) clearTimeout(rightOffsetSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  // Set drawing chart/series refs once charts are mounted (candles trigger mount)
  useEffect(() => {
    if (candles.length > 0) {
      setDrawingChart(klineRef.current?.chart ?? null);
      setDrawingSeries(klineRef.current?.candleSeries ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

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

  const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 2,
    color: 'var(--text-secondary)',
    fontSize: 11,
    padding: '2px 6px',
    cursor: 'pointer',
    marginLeft: 4,
  };

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
      {/* Chart toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 24, padding: '0 4px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <button style={toolbarBtnStyle} onClick={() => setShowDataSource(true)}>数据源</button>
        <button style={toolbarBtnStyle} onClick={() => setShowCapitalFlow(true)}>资金流向</button>
        <button style={toolbarBtnStyle} onClick={() => setShowHeatmap(true)}>热力图</button>
        <button style={toolbarBtnStyle} onClick={() => setShowScreener(true)}>选股</button>
        <button style={toolbarBtnStyle} onClick={() => setShowFormula(true)}>公式</button>
        <button style={toolbarBtnStyle} onClick={() => setShowIntervalStats(true)}>区间统计</button>
        <button style={toolbarBtnStyle} onClick={() => setShowPriceScale(true)}>坐标</button>
        <button style={toolbarBtnStyle} onClick={() => setShowSettings(true)}>设置</button>
      </div>

      {/* K-Line area */}
      <div style={chartAreaStyle('0 0 55%')}>
        <KLineChart ref={klineRef} />
        <DrawingCanvas chart={drawingChart} series={drawingSeries} />
        <DrawingToolbar />
        <Crosshair chartArea="kline" />
        <InfoTooltip />
      </div>

      {/* Volume area */}
      <div style={chartAreaStyle('0 0 20%')}>
        <VolumeChart ref={volumeRef} candles={candles} />
        <Crosshair chartArea="volume" />
      </div>

      {/* Indicator area with tab bar */}
      <div style={{ flex: '0 0 25%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <IndicatorTabBar />
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <IndicatorChart ref={indicatorRef} candles={candles} formulaOverlay={formulaOverlay} />
          <Crosshair chartArea="indicator" />
        </div>
      </div>

      {showDataSource && <DataSourceSettings onClose={() => setShowDataSource(false)} />}
      {showCapitalFlow && <CapitalFlowDialog onClose={() => setShowCapitalFlow(false)} />}
      {showHeatmap && <SectorHeatmap onClose={() => setShowHeatmap(false)} />}
      {showScreener && <StockScreener onClose={() => setShowScreener(false)} />}
      {showSettings && <ChartSettingsDialog onClose={() => setShowSettings(false)} />}
      {showPriceScale && <PriceScaleDialog onClose={() => setShowPriceScale(false)} />}
      {showIntervalStats && <IntervalStatsDialog onClose={() => setShowIntervalStats(false)} />}
      {showFormula && (
        <FormulaEditor
          candles={candles}
          onClose={() => setShowFormula(false)}
          onResult={(series) => {
            setFormulaOverlay(series);
            setShowFormula(false);
          }}
        />
      )}
    </div>
  );
}
