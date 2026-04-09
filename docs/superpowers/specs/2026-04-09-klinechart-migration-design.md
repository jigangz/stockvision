# KLineChart Migration Design

**Date:** 2026-04-09
**Version:** 0.3.1 → 0.4.0
**Status:** Approved

## Goal

Replace Lightweight Charts 4.x with KLineChart 10.x as StockVision's charting engine. Preserve all existing features while deleting ~2000 lines of manual chart sync/render code that KLineChart handles natively.

## Context

StockVision is a Tauri 2.x desktop stock app (仿通达信) with React 18 + TypeScript frontend and FastAPI Python backend. The current charting stack uses three separate Lightweight Charts instances (K-line, Volume, Indicator) manually synced via 500+ lines of crosshair/time/zoom synchronization code. KLineChart v10.0.0-beta1 is already installed but not yet wired up.

## Architecture

### Before (Lightweight Charts)
```
ChartContainer.tsx
├── KLineChart.tsx        (candlestick + MA overlays, ~300 LOC)
├── VolumeChart.tsx        (volume bars, ~200 LOC)
├── IndicatorChart.tsx     (MACD/KDJ/etc, ~400 LOC)
├── DrawingOverlay.tsx     (canvas drawings, ~600 LOC)
└── Manual sync code       (crosshair, time axis, zoom — ~500 LOC)
```

### After (KLineChart)
```
ChartContainer.tsx
└── KLineChartWrapper.tsx  (single KLineChart instance, ~200 LOC)
    ├── Main pane: candlestick + MA overlays (native)
    ├── Upper indicator pane (native sub-chart)
    ├── Lower indicator pane (native sub-chart)
    ├── Crosshair/zoom/time sync (native — zero code)
    └── Overlays (15 native + 17 custom registerOverlay)
```

Single `init()` call creates a chart with built-in multi-pane, crosshair sync, time axis sync, and zoom sync.

### Zustand Stores (unchanged interfaces)
- `chartStore` — activeView, currentCode, zoomLevel, period
- `indicatorStore` — activeIndicatorUpper/Lower, params
- `drawingStore` — drawings[], activeTool, selectedId, locked
- `crosshairStore` — activeBarIndex, keyboardNavMode
- `dataStore` — candles[], quotes

Store interfaces stay the same. Only the consumers (chart components) change.

## Feature Audit

### KLineChart Native — Delete Our Code (~2000 LOC)
| Feature | KLineChart API |
|---------|---------------|
| Candlestick + MA | `chart.createIndicator('MA', ...)` |
| Volume pane | Built-in indicator in sub-pane |
| MACD, KDJ, RSI, BOLL, WR, DMI, OBV, CCI, EMV, SAR, BIAS, MTM, DMA, TRIX, VR, CR, PSY, ROC, BRAR | Built-in indicators |
| Crosshair sync | Native multi-pane |
| Time axis sync | Native |
| Zoom sync | Native |
| Tooltip / data window | Native |
| Dark theme | `chart.setStyles(darkTheme)` |
| Scroll zoom (mouse wheel) | Native |
| 15 overlay types: horizontalStraightLine, verticalStraightLine, straightLine, segment, ray, priceLine, horizontalRayLine, verticalRayLine, parallelStraightLine, priceChannelLine, fibonacciLine, simpleAnnotation, simpleTag, rect, circle | `chart.createOverlay('segment', ...)` |
| Magnet mode | `crosshair.mode` config |
| Drag-edit overlays | Native |

### Custom Code Required (6 items)
1. **FSL indicator** — `registerIndicator()` with existing Python calc, render as line
2. **MOST indicator** — `registerIndicator()` with existing Python calc
3. **ASI indicator** — `registerIndicator()` with existing Python calc
4. **17 custom overlays** — `registerOverlay()` for: fibonacciFan, fibonacciArc, fibonacciTimezone, gannSquare, gannFan, speedResistance, percentLine, cycleLine, sineCurve, spiralLine, andrewsPitchfork, waveLine, arrowLine, textAnnotation, buyMark, sellMark, measureTool
5. **Keyboard navigation** — Adapt `useKeyboardShortcuts.ts` to KLineChart API (`chart.scrollByDistance()`, `chart.crosshairPosition()`)
6. **Right-click context menu** — Keep `DrawingContextMenu.tsx`, wire to KLineChart overlay events

### Untouched Components
- FormulaEditor, StockScreener, SectorHeatmap, CapitalFlowDialog
- DataSourceSettings, KeyboardWizard, WatchlistSidebar
- MarketView, StockInfoPanel, InfoPanel
- TopNav, StatusBar, MainLayout (except zoomLevel hiding logic)
- All Zustand stores (interface-compatible)
- Python backend (zero changes)

## Data Adapter

KLineChart expects:
```typescript
interface KLineData {
  timestamp: number;   // milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;
}
```

Our candles format:
```typescript
interface Candle {
  time: string;    // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}
```

Adapter: `candles.map(c => ({ timestamp: new Date(c.time).getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.amount }))`

## Migration Phases

### Phase 1: Core K-line + Data (delete ~500 LOC, write ~200 LOC)
- Create `KLineChartWrapper.tsx` with `init()`, data adapter, theme
- Wire to `dataStore.candles` for data feed
- Replace `ChartContainer.tsx` children with single wrapper
- Delete `KLineChart.tsx`, `VolumeChart.tsx` old components

### Phase 2: Indicators (delete ~400 LOC, write ~100 LOC)
- Register 19 built-in indicators
- Create 3 custom indicators (FSL, MOST, ASI) via `registerIndicator()`
- Wire `indicatorStore` upper/lower selection to `chart.createIndicator()`
- Wire params dialog to `chart.overrideIndicator()`
- Add indicator header labels (DOM overlay or KLineChart bindings)

### Phase 3: Drawings (delete ~600 LOC, write ~400 LOC)
- Map 15 native overlay types
- Create 17 custom overlays via `registerOverlay()`
- Wire `drawingStore` to overlay create/remove/select
- Wire right-click context menu to overlay events
- Preserve lock/edit state

### Phase 4: BacktestResult (delete ~200 LOC, write ~100 LOC)
- Replace BacktestResult's Lightweight Charts with KLineChart
- Buy/sell markers as custom overlays

### Phase 5: Interactions (modify ~200 LOC)
- Adapt `useKeyboardShortcuts.ts` to KLineChart API
- Wire crosshair store to KLineChart crosshair events
- Zoom level 0/1/2 panel hiding (keep existing MainLayout logic)

### Phase 6: Cleanup
- Remove `lightweight-charts` from package.json
- Delete unused types/interfaces
- Bump version to 0.4.0
- Run typecheck + tests

## Risk Mitigation
- KLineChart v10 is beta — pin exact version, test thoroughly
- Keep old components in git history (don't squash)
- Each phase is independently testable
- Ralph loop provides self-verification at each step

## Verification Command
```bash
npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..
```

## Net Impact
- **Delete:** ~2000 lines of manual chart code
- **Write:** ~800 lines (wrapper + custom indicators + custom overlays)
- **Net reduction:** ~1200 lines
- **Dependencies removed:** lightweight-charts
- **Dependencies kept:** klinecharts (already installed)
