import { useEffect, useRef, useState, useCallback } from 'react';
import { KLineChartWrapper, type KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { DrawingBridge } from '@/components/chart/DrawingBridge';
import { DrawingContextMenu } from '@/components/chart/DrawingContextMenu';
import { DrawingToolbar } from '@/components/chart/DrawingToolbar';
import { IndicatorTabBar } from '@/components/chart/IndicatorTabBar';
import { ChartSettingsDialog } from '@/components/chart/ChartSettingsDialog';
import { PriceScaleDialog } from '@/components/chart/PriceScaleDialog';
import { IntervalStatsDialog } from '@/components/chart/IntervalStatsDialog';
import { FormulaEditor } from '@/components/chart/FormulaEditor';
import { StockScreener } from '@/components/chart/StockScreener';
import { SectorHeatmap } from '@/components/chart/SectorHeatmap';
import { CapitalFlowDialog } from '@/components/chart/CapitalFlowDialog';
import { DataSourceSettings } from '@/components/chart/DataSourceSettings';
import { BacktestResult } from '@/components/chart/BacktestResult';
import { StockCodeInput } from '@/components/chart/StockCodeInput';
import type { FormulaSeries } from '@/types/chart';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore, getDefaultRightOffset } from '@/stores/chartSettingsStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function ChartContainer(): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const fetchKline = useDataStore((s) => s.fetchKline);
  const fetchKlineInitial = useDataStore((s) => s.fetchKlineInitial);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);
  const displayDays = useChartSettingsStore((s) => s.displayDays);
  const setRightOffset = useChartSettingsStore((s) => s.setRightOffset);
  const fetchSettings = useChartSettingsStore((s) => s.fetchSettings);
  const loadDrawings = useDrawingStore((s) => s.loadDrawings);
  const watchlistCodes = useWatchlistStore((s) => s.codes);
  const toggleCode = useWatchlistStore((s) => s.toggleCode);

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
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const chartWrapperRef = useRef<KLineChartWrapperHandle>(null);

  useEffect(() => { void fetchSettings(); }, [fetchSettings]);

  useEffect(() => {
    setRightOffset(getDefaultRightOffset(currentPeriod));
  }, [currentPeriod, setRightOffset]);

  const getStartDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - displayDays);
    return d.toISOString().slice(0, 10);
  }, [displayDays]);

  useEffect(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKlineInitial(currentCode, currentMarket, currentPeriod, start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, currentMarket, currentPeriod, displayDays]);

  useEffect(() => {
    void loadDrawings(currentCode, currentPeriod);
  }, [currentCode, currentPeriod, loadDrawings]);

  const anyDialogOpen =
    showSettings || showPriceScale || showIntervalStats || showFormula ||
    showScreener || showHeatmap || showCapitalFlow || showDataSource ||
    showBacktest || showCodeInput;

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

  const handleRefresh = useCallback(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKline(currentCode, currentMarket, currentPeriod, start, end);
  }, [fetchKline, currentCode, currentMarket, currentPeriod, getStartDate]);

  useKeyboardShortcuts({
    chartWrapper: chartWrapperRef,
    onRefresh: handleRefresh,
    onStockInfo: () => setShowIntervalStats(true),
    anyDialogOpen,
    onCloseDialog: closeTopDialog,
    onEnterCode: () => setShowCodeInput(true),
  });

  const inWatchlist = watchlistCodes.includes(currentCode);

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
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 24,
          padding: '0 4px',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button
          style={{ ...toolbarBtnStyle, color: inWatchlist ? '#FFD700' : 'var(--text-secondary)' }}
          onClick={() => toggleCode(currentCode)}
          title={inWatchlist ? '移出自选' : '加入自选'}
        >&#11088;&#33258;&#36873;</button>
        <button
          style={{ ...toolbarBtnStyle, color: showDrawingToolbar ? '#FFFF00' : 'var(--text-secondary)' }}
          onClick={() => setShowDrawingToolbar((v) => !v)}
        >&#30011;&#32447;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowBacktest(true)}>&#22238;&#27979;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowDataSource(true)}>&#25968;&#25454;&#28304;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowCapitalFlow(true)}>&#36164;&#37329;&#27969;&#21521;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowHeatmap(true)}>&#29031;&#21010;&#22270;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowScreener(true)}>&#36873;&#32929;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowFormula(true)}>&#20844;&#24335;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowIntervalStats(true)}>&#21306;&#38388;&#32479;&#35745;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowPriceScale(true)}>&#22352;&#26631;</button>
        <button style={toolbarBtnStyle} onClick={() => setShowSettings(true)}>&#35774;&#32622;</button>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <KLineChartWrapper ref={chartWrapperRef} />
        <DrawingBridge chart={chartWrapperRef.current?.chart ?? null} />
        {showDrawingToolbar && <DrawingToolbar />}
        {ctxMenu && (
          <DrawingContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            chart={chartWrapperRef.current?.chart ?? null}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>

      <IndicatorTabBar />

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
            setFormulaOverlay(series as FormulaSeries[]);
            setShowFormula(false);
          }}
        />
      )}
      {formulaOverlay.length > 0 && null}
    </div>
  );
}
