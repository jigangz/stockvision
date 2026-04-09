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
import { BacktestResult } from '@/components/chart/BacktestResult';
import { StockCodeInput } from '@/components/chart/StockCodeInput';
import type { FormulaSeries } from '@/components/chart/IndicatorChart';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore, getDefaultRightOffset } from '@/stores/chartSettingsStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { useCrosshairSync } from '@/hooks/useCrosshairSync';
import { useWheelZoom } from '@/hooks/useWheelZoom';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const fetchKlineInitial = useDataStore((s) => s.fetchKlineInitial);
  const fetchMoreBars = useDataStore((s) => s.fetchMoreBars);
  const allLoaded = useDataStore((s) => s.allLoaded);
  const loadingMore = useDataStore((s) => s.loadingMore);
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
  const [showBacktest, setShowBacktest] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [formulaOverlay, setFormulaOverlay] = useState<FormulaSeries[]>([]);
  const [showDrawingToolbar, setShowDrawingToolbar] = useState(false);
  const [drawingChart, setDrawingChart] = useState<IChartApi | null>(null);
  const [drawingSeries, setDrawingSeries] = useState<ISeriesApi<SeriesType> | null>(null);

  const klineRef = useRef<KLineChartHandle>(null);
  const volumeRef = useRef<VolumeChartHandle>(null);
  const indicatorRef = useRef<IndicatorChartHandle>(null);

  // Load persisted settings on mount
  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Update rightOffset when period changes (smart default per period type)
  useEffect(() => {
    const newOffset = getDefaultRightOffset(currentPeriod);
    setRightOffset(newOffset);
  }, [currentPeriod, setRightOffset]);

  // Compute start date from displayDays
  const getStartDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - displayDays);
    return d.toISOString().slice(0, 10);
  }, [displayDays]);

  // Initial load: show last 100 bars immediately for fast first paint
  useEffect(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKlineInitial(currentCode, currentMarket, currentPeriod, start, end);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, currentMarket, currentPeriod, displayDays]);

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

  // Lazy load: when user scrolls near the left edge, fetch older bars
  useEffect(() => {
    const kChart = klineRef.current?.chart;
    if (!kChart || !candles.length) return;

    const lazyHandler = () => {
      const range = kChart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      // Trigger when fewer than 20 bars remain to the left of the visible area
      if (range.from <= 20 && !allLoaded && !loadingMore) {
        void fetchMoreBars();
      }
    };

    kChart.timeScale().subscribeVisibleLogicalRangeChange(lazyHandler);
    return () => {
      kChart.timeScale().unsubscribeVisibleLogicalRangeChange(lazyHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, allLoaded, loadingMore]);

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

  // Compute anyDialogOpen for Esc handling
  const anyDialogOpen =
    showSettings || showPriceScale || showIntervalStats || showFormula ||
    showScreener || showHeatmap || showCapitalFlow || showDataSource ||
    showBacktest || showCodeInput;

  // Close the topmost dialog (ordered by priority)
  const closeTopDialog = useCallback(() => {
    if (showCodeInput) { setShowCodeInput(false); return; }
    if (showBacktest) { setShowBacktest(false); return; }
    if (showDataSource) { setShowDataSource(false); return; }
    if (showCapitalFlow) { setShowCapitalFlow(false); return; }
    if (showHeatmap) { setShowHeatmap(false); return; }
    if (showScreener) { setShowScreener(false); return; }
    if (showFormula) { setShowFormula(false); return; }
    if (showIntervalStats) { setShowIntervalStats(false); return; }
    if (showPriceScale) { setShowPriceScale(false); return; }
    if (showSettings) { setShowSettings(false); return; }
  }, [showCodeInput, showBacktest, showDataSource, showCapitalFlow, showHeatmap, showScreener, showFormula, showIntervalStats, showPriceScale, showSettings]);

  // Refresh current chart data
  const handleRefresh = useCallback(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKline(currentCode, currentMarket, currentPeriod, start, end);
  }, [fetchKline, currentCode, currentMarket, currentPeriod, getStartDate]);

  // Keyboard shortcuts (F5/F10/arrows/PageUp/PageDown/Home/End/Enter/Esc/Ctrl+Z/Delete)
  useKeyboardShortcuts({
    klineRef,
    charts: zoomCharts,
    onRefresh: handleRefresh,
    onStockInfo: () => setShowIntervalStats(true),
    anyDialogOpen,
    onCloseDialog: closeTopDialog,
    onEnterCode: () => setShowCodeInput(true),
  });

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
        <button
          style={{ ...toolbarBtnStyle, color: showDrawingToolbar ? '#FFFF00' : 'var(--text-secondary)' }}
          onClick={() => setShowDrawingToolbar((v) => !v)}
        >画线</button>
        <button style={toolbarBtnStyle} onClick={() => setShowBacktest(true)}>回测</button>
        <button style={toolbarBtnStyle} onClick={() => setShowDataSource(true)}>数据源</button>
        <button style={toolbarBtnStyle} onClick={() => setShowCapitalFlow(true)}>资金流向</button>
        <button style={toolbarBtnStyle} onClick={() => setShowHeatmap(true)}>热力图</button>
        <button style={toolbarBtnStyle} onClick={() => setShowScreener(true)}>选股</button>
        <button style={toolbarBtnStyle} onClick={() => setShowFormula(true)}>公式</button>
        <button style={toolbarBtnStyle} onClick={() => setShowIntervalStats(true)}>区间统计</button>
        <button style={toolbarBtnStyle} onClick={() => setShowPriceScale(true)}>坐标</button>
        <button style={toolbarBtnStyle} onClick={() => setShowSettings(true)}>设置</button>
      </div>

      {/* K-Line area — flex-grow proportional (55:20:25) */}
      <div style={{ ...chartAreaStyle('55 1 0'), borderBottom: '2px solid #444' }}>
        <KLineChart ref={klineRef} />
        <DrawingCanvas chart={drawingChart} series={drawingSeries} />
        {showDrawingToolbar && <DrawingToolbar />}
        <Crosshair chartArea="kline" />
        <InfoTooltip />
      </div>

      {/* Volume area */}
      <div style={{ ...chartAreaStyle('20 1 0'), borderBottom: '2px solid #444' }}>
        <VolumeChart ref={volumeRef} candles={candles} />
        <Crosshair chartArea="volume" />
      </div>

      {/* Indicator area with tab bar */}
      <div style={{ flex: '25 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <IndicatorTabBar />
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <IndicatorChart ref={indicatorRef} candles={candles} formulaOverlay={formulaOverlay} />
          <Crosshair chartArea="indicator" />
        </div>
      </div>

      {showBacktest && <BacktestResult onClose={() => setShowBacktest(false)} />}
      {showDataSource && <DataSourceSettings onClose={() => setShowDataSource(false)} />}
      {showCapitalFlow && <CapitalFlowDialog onClose={() => setShowCapitalFlow(false)} />}
      {showHeatmap && <SectorHeatmap onClose={() => setShowHeatmap(false)} />}
      {showScreener && <StockScreener onClose={() => setShowScreener(false)} />}
      {showSettings && <ChartSettingsDialog onClose={() => setShowSettings(false)} />}
      {showPriceScale && <PriceScaleDialog onClose={() => setShowPriceScale(false)} />}
      {showIntervalStats && <IntervalStatsDialog onClose={() => setShowIntervalStats(false)} />}
      {showCodeInput && <StockCodeInput onClose={() => setShowCodeInput(false)} />}
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
