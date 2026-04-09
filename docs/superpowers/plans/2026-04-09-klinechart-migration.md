# KLineChart Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lightweight Charts 4.x with KLineChart 10.x as the sole charting engine, preserving all existing features while deleting ~2000 lines of manual chart sync code.

**Architecture:** Single `klinecharts.init()` instance replaces 3 separate Lightweight Charts (KLineChart, VolumeChart, IndicatorChart). KLineChart natively handles multi-pane layout, crosshair sync, time axis sync, zoom sync, and 26 built-in indicators. Custom code is only needed for 3 indicators (FSL, MOST, ASI), 17 custom overlays, keyboard navigation, and context menus.

**Tech Stack:** klinecharts 10.0.0-beta1, React 18, TypeScript, Zustand 5, Vite 6

**Verify command:** `npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/chart/KLineChartWrapper.tsx` | Single KLineChart instance, data adapter, theme, pane management |
| `src/theme/klineTheme.ts` | KLineChart dark theme styles (replaces LW Charts darkTheme.ts) |
| `src/chart/dataAdapter.ts` | Convert `OhlcvData[]` → `KLineData[]` |
| `src/chart/customIndicators.ts` | Register FSL, MOST, ASI custom indicators |
| `src/chart/customOverlays.ts` | Register 17 custom overlay types |
| `src/chart/overlayMapping.ts` | Map DrawingToolType → KLineChart overlay name |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/chart/ChartContainer.tsx` | Replace 3 chart refs with single KLineChartWrapper ref; remove useCrosshairSync, useWheelZoom, useChartSync; simplify data flow |
| `src/hooks/useKeyboardShortcuts.ts` | Replace LW Charts `setCrosshairPosition`/`setVisibleLogicalRange` with KLineChart `scrollToDataIndex`/`executeAction`/`zoomAtCoordinate` |
| `src/components/chart/DrawingCanvas.tsx` | Replace LW Charts `toPixel`/`toPoint` with KLineChart `convertToPixel`/`convertFromPixel`; OR delete entirely if using KLineChart native overlays |
| `src/components/chart/DrawingContextMenu.tsx` | Wire to KLineChart overlay events instead of custom hit-testing |
| `src/components/chart/Crosshair.tsx` | Delete — KLineChart has native crosshair |
| `src/components/chart/InfoTooltip.tsx` | Replace with KLineChart native tooltip OR adapt to read from KLineChart crosshair event |
| `src/components/chart/BacktestResult.tsx` | Replace LW Charts equity curve with KLineChart instance |
| `src/stores/crosshairStore.ts` | Simplify — only store `activeBarIndex` and `isKeyboardNavMode` |
| `src/hooks/useCrosshairSync.ts` | Delete — KLineChart syncs crosshair natively |
| `src/hooks/useWheelZoom.ts` | Delete — KLineChart syncs zoom natively |
| `src/hooks/useChartSync.ts` | Delete — KLineChart syncs range natively |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/chart/KLineChart.tsx` | Replaced by KLineChartWrapper.tsx |
| `src/components/chart/VolumeChart.tsx` | Volume is now a KLineChart built-in indicator pane |
| `src/components/chart/IndicatorChart.tsx` | Indicators now managed via `chart.createIndicator()` |
| `src/components/chart/Crosshair.tsx` | KLineChart has native crosshair |
| `src/hooks/useCrosshairSync.ts` | KLineChart syncs crosshair natively |
| `src/hooks/useWheelZoom.ts` | KLineChart syncs zoom natively |
| `src/hooks/useChartSync.ts` | KLineChart syncs range natively |
| `src/theme/darkTheme.ts` | Replaced by klineTheme.ts |
| `src/workers/indicator.worker.ts` | KLineChart calculates indicators internally |

---

## Task 1: Data Adapter + Theme

**Files:**
- Create: `src/chart/dataAdapter.ts`
- Create: `src/theme/klineTheme.ts`

- [ ] **Step 1: Create data adapter**

```typescript
// src/chart/dataAdapter.ts
import type { KLineData } from 'klinecharts';
import type { OhlcvData } from '@/stores/dataStore';

/**
 * Convert our OhlcvData format to KLineChart's KLineData format.
 * OhlcvData.time is "YYYY-MM-DD" string; KLineData.timestamp is milliseconds.
 */
export function toKLineData(candles: OhlcvData[]): KLineData[] {
  return candles.map((c) => ({
    timestamp: new Date(c.time).getTime(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    turnover: c.amount,
  }));
}

/**
 * Convert a single candle for live updates.
 */
export function toSingleKLineData(candle: OhlcvData): KLineData {
  return {
    timestamp: new Date(candle.time).getTime(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.amount,
  };
}
```

- [ ] **Step 2: Create KLineChart dark theme**

```typescript
// src/theme/klineTheme.ts
import type { DeepPartial } from 'klinecharts';
// Note: Styles type from klinecharts
// KLineChart uses setStyles() not constructor options for theming

export const darkStyles: Record<string, unknown> = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: '#333333',
      style: 'dashed',
      dashedValue: [2, 2],
    },
    vertical: {
      show: true,
      size: 1,
      color: '#333333',
      style: 'dashed',
      dashedValue: [2, 2],
    },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      upColor: '#FF4444',
      downColor: '#00CC66',
      noChangeColor: '#888888',
      upBorderColor: '#FF4444',
      downBorderColor: '#00CC66',
      noChangeBorderColor: '#888888',
      upWickColor: '#FF4444',
      downWickColor: '#00CC66',
      noChangeWickColor: '#888888',
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#FF4444', textSize: 10 },
      low: { show: true, color: '#00CC66', textSize: 10 },
      last: {
        show: true,
        upColor: '#FF4444',
        downColor: '#00CC66',
        noChangeColor: '#888888',
        line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
        text: { show: true, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
      },
    },
    tooltip: {
      showRule: 'always',
      showType: 'rect',
      custom: [
        { title: '时间', value: '{time}' },
        { title: '开', value: '{open}' },
        { title: '高', value: '{high}' },
        { title: '低', value: '{low}' },
        { title: '收', value: '{close}' },
        { title: '量', value: '{volume}' },
      ],
      text: { size: 11, color: '#CCCCCC' },
    },
  },
  indicator: {
    lastValueMark: { show: false },
    tooltip: {
      showRule: 'always',
      showName: true,
      showParams: true,
      showValue: true,
      text: { size: 11 },
    },
    lines: [
      { color: '#FFFF00', size: 1, style: 'solid', smooth: false },   // MA5 / line 1
      { color: '#FF00FF', size: 1, style: 'solid', smooth: false },   // MA10 / line 2
      { color: '#00FF00', size: 1, style: 'solid', smooth: false },   // MA20 / line 3
      { color: '#FFFFFF', size: 1, style: 'solid', smooth: false },   // MA60 / line 4
      { color: '#FF8800', size: 1, style: 'solid', smooth: false },   // line 5
      { color: '#00CCFF', size: 1, style: 'solid', smooth: false },   // line 6
    ],
  },
  xAxis: {
    show: true,
    size: 'auto',
    axisLine: { show: true, color: '#555555', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#555555' },
    tickText: { show: true, color: '#CCCCCC', size: 10 },
  },
  yAxis: {
    show: true,
    size: 'auto',
    position: 'right',
    type: 'normal',
    axisLine: { show: true, color: '#333333', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#333333' },
    tickText: { show: true, color: '#CCCCCC', size: 10 },
  },
  separator: {
    size: 2,
    color: '#444444',
    activeBackgroundColor: 'rgba(255,255,255,0.1)',
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: { show: true, color: '#000000', borderColor: '#888888', backgroundColor: '#CCCCCC', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: { show: true, color: '#000000', borderColor: '#888888', backgroundColor: '#CCCCCC', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
  },
  overlay: {
    point: { color: '#FFFFFF', borderColor: '#FFFFFF', borderSize: 1, radius: 4, activeColor: '#FFFF00', activeBorderColor: '#FFFF00', activeBorderSize: 1, activeRadius: 6 },
    line: { style: 'solid', color: '#FFFFFF', size: 1, smooth: false },
    rect: { style: 'stroke', color: 'rgba(255,255,255,0.2)', borderColor: '#FFFFFF', borderSize: 1, borderStyle: 'solid', borderRadius: 0 },
    text: { color: '#FFFFFF', size: 12, family: 'monospace', weight: 'normal' },
  },
};

/** MA indicator line colors (for reference in custom code) */
export const MA_COLORS = {
  ma5: '#FFFF00',
  ma10: '#FF00FF',
  ma20: '#00FF00',
  ma60: '#FFFFFF',
};

/** Volume up/down colors */
export const VOLUME_COLORS = {
  up: '#FF4444',
  down: '#00CC66',
};
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd D:/stockvision && npx tsc --noEmit`
Expected: PASS (new files are standalone, no imports yet)

- [ ] **Step 4: Commit**

```bash
git add src/chart/dataAdapter.ts src/theme/klineTheme.ts
git commit -m "feat: add KLineChart data adapter and dark theme"
```

---

## Task 2: KLineChartWrapper — Core Component

**Files:**
- Create: `src/components/chart/KLineChartWrapper.tsx`

- [ ] **Step 1: Create KLineChartWrapper component**

This is the main component that replaces KLineChart.tsx + VolumeChart.tsx + IndicatorChart.tsx. It creates one KLineChart instance with built-in multi-pane support.

```typescript
// src/components/chart/KLineChartWrapper.tsx
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { init, dispose, type Chart, type KLineData, type OverlayCreate } from 'klinecharts';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useIndicatorStore, type IndicatorType } from '@/stores/indicatorStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDrawingStore } from '@/stores/drawingStore';
import { toKLineData } from '@/chart/dataAdapter';
import { darkStyles } from '@/theme/klineTheme';
import { OVERLAY_MAP } from '@/chart/overlayMapping';

export interface KLineChartWrapperHandle {
  /** The KLineChart instance */
  chart: Chart | null;
  /** Pane ID for the upper indicator section */
  upperPaneId: string | null;
  /** Pane ID for the lower indicator section */
  lowerPaneId: string | null;
}

export const KLineChartWrapper = forwardRef<KLineChartWrapperHandle>(
  function KLineChartWrapper(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const upperPaneIdRef = useRef<string | null>(null);
    const lowerPaneIdRef = useRef<string | null>(null);

    // Store selectors
    const candles = useDataStore((s) => s.candles);
    const zoomLevel = useChartStore((s) => s.zoomLevel);
    const rightOffset = useChartSettingsStore((s) => s.rightOffset);
    const priceScaleMode = useChartSettingsStore((s) => s.priceScaleMode);
    const priceMin = useChartSettingsStore((s) => s.priceMin);
    const priceMax = useChartSettingsStore((s) => s.priceMax);
    const activeIndicatorUpper = useIndicatorStore((s) => s.activeIndicatorUpper);
    const activeIndicatorLower = useIndicatorStore((s) => s.activeIndicatorLower);
    const upperParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorUpper]);
    const lowerParams = useIndicatorStore((s) => s.indicatorParams[s.activeIndicatorLower]);

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get upperPaneId() { return upperPaneIdRef.current; },
      get lowerPaneId() { return lowerPaneIdRef.current; },
    }));

    // Initialize chart
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const chart = init(el, {
        locale: 'zh-CN',
        styles: darkStyles as never,
      });

      if (!chart) return;
      chartRef.current = chart;

      // Set right offset
      chart.setOffsetRightDistance(rightOffset * 8); // approximate bar spacing

      // Create MA indicators on main pane
      chart.createIndicator({ name: 'MA', calcParams: [5, 10, 20, 60] }, false);

      // Create upper indicator pane (VOL default)
      const upperPaneId = chart.createIndicator('VOL', true, {
        height: 100,
        dragEnabled: true,
      });
      upperPaneIdRef.current = upperPaneId;

      // Create lower indicator pane (MACD default)
      const lowerPaneId = chart.createIndicator('MACD', true, {
        height: 100,
        dragEnabled: true,
      });
      lowerPaneIdRef.current = lowerPaneId;

      // Subscribe crosshair events for store sync
      chart.subscribeAction('onCrosshairChange', (data: unknown) => {
        const crosshair = data as { dataIndex?: number; kLineData?: KLineData };
        if (crosshair?.dataIndex != null) {
          useCrosshairStore.getState().setPosition({ activeBarIndex: crosshair.dataIndex });
        }
      });

      return () => {
        dispose(el);
        chartRef.current = null;
        upperPaneIdRef.current = null;
        lowerPaneIdRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Feed data when candles change
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !candles.length) return;

      const klineData = toKLineData(candles);
      // resetData + applyNewData to fully replace
      chart.resetData();
      // KLineChart v10 uses setDataLoader or direct data methods
      // For static data, we use the internal store's data list
      // The simplest approach: use chart.getDataList() after init
      // Actually in v10, data is fed via DataLoader
      // Let's set data directly via the chart's store
      const dataList = chart.getDataList();
      dataList.length = 0;
      dataList.push(...klineData);
      chart.resize(); // force re-render
    }, [candles]);

    // Update upper indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = upperPaneIdRef.current;
      if (!chart || !paneId) return;

      // Remove old indicator from this pane
      chart.removeIndicator({ paneId });
      // Create new one
      const calcParams = upperParams
        ? Object.values(upperParams)
        : undefined;
      chart.createIndicator(
        {
          name: activeIndicatorUpper,
          ...(calcParams ? { calcParams } : {}),
        },
        true,
        { id: paneId },
      );
    }, [activeIndicatorUpper, upperParams]);

    // Update lower indicator when selection changes
    useEffect(() => {
      const chart = chartRef.current;
      const paneId = lowerPaneIdRef.current;
      if (!chart || !paneId) return;

      chart.removeIndicator({ paneId });
      const calcParams = lowerParams
        ? Object.values(lowerParams)
        : undefined;
      chart.createIndicator(
        {
          name: activeIndicatorLower,
          ...(calcParams ? { calcParams } : {}),
        },
        true,
        { id: paneId },
      );
    }, [activeIndicatorLower, lowerParams]);

    // Handle zoom level (hide/show indicator panes)
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const upperPaneId = upperPaneIdRef.current;
      const lowerPaneId = lowerPaneIdRef.current;

      if (zoomLevel >= 2) {
        // Hide both indicator panes
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, state: 'minimize' });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, state: 'minimize' });
      } else {
        // Show both indicator panes
        if (upperPaneId) chart.setPaneOptions({ id: upperPaneId, state: 'normal', height: 100 });
        if (lowerPaneId) chart.setPaneOptions({ id: lowerPaneId, state: 'normal', height: 100 });
      }
    }, [zoomLevel]);

    // Apply price scale mode
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      // KLineChart doesn't have direct priceMin/Max — we use yAxis range override
      // For manual mode, we'd need to set yAxis min/max via custom axis
      // For now, auto mode is default behavior
    }, [priceScaleMode, priceMin, priceMax]);

    // Handle right offset
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.setOffsetRightDistance(rightOffset * 8);
    }, [rightOffset]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    );
  },
);
```

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

Note: This will have errors because `overlayMapping.ts` doesn't exist yet. Proceed to Task 3.

- [ ] **Step 3: Commit (even with typecheck warnings)**

```bash
git add src/components/chart/KLineChartWrapper.tsx
git commit -m "feat: add KLineChartWrapper core component (WIP)"
```

---

## Task 3: Overlay Mapping + Custom Overlays

**Files:**
- Create: `src/chart/overlayMapping.ts`
- Create: `src/chart/customOverlays.ts`

- [ ] **Step 1: Create overlay mapping**

Maps our DrawingToolType to KLineChart overlay names.

```typescript
// src/chart/overlayMapping.ts

/**
 * Maps StockVision DrawingToolType → KLineChart overlay name.
 * Built-in overlays use KLineChart's registered name directly.
 * Custom overlays use our registered prefix 'sv_'.
 */
export const OVERLAY_MAP: Record<string, string> = {
  // Lines — KLineChart built-in
  trendline: 'straightLine',
  ray: 'rayLine',
  segment: 'segment',
  horizontal: 'horizontalStraightLine',
  vertical: 'verticalStraightLine',
  parallel_line: 'parallelStraightLine',
  price_line: 'priceLine',

  // Channels — KLineChart built-in
  channel: 'priceChannelLine',

  // Fibonacci — KLineChart built-in
  fibRetracement: 'fibonacciLine',

  // Shapes — KLineChart built-in
  rectangle: 'rect',
  triangle: 'polygon',
  text: 'simpleAnnotation',

  // Custom overlays (registered with 'sv_' prefix)
  arrow: 'sv_arrow',
  arc: 'sv_arc',
  ellipse: 'sv_ellipse',
  pitchfork: 'sv_pitchfork',
  regressionChannel: 'sv_regressionChannel',
  fibExtension: 'sv_fibExtension',
  fib_fan: 'sv_fibFan',
  fib_arc: 'sv_fibArc',
  fib_timezone: 'sv_fibTimezone',
  gannAngle: 'sv_gannAngle',
  gannFan: 'sv_gannFan',
  gannGrid: 'sv_gannGrid',
  gannSquare: 'sv_gannSquare',
  speedResistance: 'sv_speedResistance',
  percentLine: 'sv_percentLine',
  cycleLine: 'sv_cycleLine',
  measure: 'sv_measure',
  buyMark: 'sv_buyMark',
  sellMark: 'sv_sellMark',
  flatMark: 'sv_flatMark',
};

/**
 * Get the KLineChart overlay name for a given DrawingToolType.
 * Falls back to the type itself if not mapped.
 */
export function getOverlayName(toolType: string): string {
  return OVERLAY_MAP[toolType] ?? toolType;
}
```

- [ ] **Step 2: Create custom overlay registrations**

```typescript
// src/chart/customOverlays.ts
import { registerOverlay } from 'klinecharts';
import type { OverlayTemplate, Coordinate, Point } from 'klinecharts';

// --- Arrow line overlay ---
const arrowOverlay: OverlayTemplate = {
  name: 'sv_arrow',
  totalStep: 3, // 2 points
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    // Arrow head
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const headLen = 12;
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;
    return [
      { type: 'line', attrs: { coordinates: [p0, p1] } },
      { type: 'line', attrs: { coordinates: [p1, { x: p1.x - headLen * Math.cos(a1), y: p1.y - headLen * Math.sin(a1) }] } },
      { type: 'line', attrs: { coordinates: [p1, { x: p1.x - headLen * Math.cos(a2), y: p1.y - headLen * Math.sin(a2) }] } },
    ];
  },
};

// --- Buy mark overlay ---
const buyMarkOverlay: OverlayTemplate = {
  name: 'sv_buyMark',
  totalStep: 2, // 1 point
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      { type: 'text', attrs: { x: p.x, y: p.y - 8, text: 'B', align: 'center', baseline: 'bottom' }, styles: { color: '#FF4444' } },
      { type: 'line', attrs: { coordinates: [{ x: p.x, y: p.y - 4 }, { x: p.x - 6, y: p.y + 8 }] }, styles: { color: '#FF4444' } },
      { type: 'line', attrs: { coordinates: [{ x: p.x, y: p.y - 4 }, { x: p.x + 6, y: p.y + 8 }] }, styles: { color: '#FF4444' } },
    ];
  },
};

// --- Sell mark overlay ---
const sellMarkOverlay: OverlayTemplate = {
  name: 'sv_sellMark',
  totalStep: 2,
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      { type: 'text', attrs: { x: p.x, y: p.y + 8, text: 'S', align: 'center', baseline: 'top' }, styles: { color: '#00CC66' } },
      { type: 'line', attrs: { coordinates: [{ x: p.x, y: p.y + 4 }, { x: p.x - 6, y: p.y - 8 }] }, styles: { color: '#00CC66' } },
      { type: 'line', attrs: { coordinates: [{ x: p.x, y: p.y + 4 }, { x: p.x + 6, y: p.y - 8 }] }, styles: { color: '#00CC66' } },
    ];
  },
};

// --- Flat mark overlay ---
const flatMarkOverlay: OverlayTemplate = {
  name: 'sv_flatMark',
  totalStep: 2,
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      { type: 'text', attrs: { x: p.x, y: p.y, text: '—', align: 'center', baseline: 'middle' }, styles: { color: '#888888' } },
    ];
  },
};

// --- Ellipse overlay (approximated with arc) ---
const ellipseOverlay: OverlayTemplate = {
  name: 'sv_ellipse',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    const rx = Math.abs(p1.x - p0.x) / 2;
    const ry = Math.abs(p1.y - p0.y) / 2;
    return [
      { type: 'arc', attrs: { x: cx, y: cy, r: rx, startAngle: 0, endAngle: Math.PI * 2 } },
    ];
  },
};

// --- Fibonacci Extension ---
const fibExtensionOverlay: OverlayTemplate = {
  name: 'sv_fibExtension',
  totalStep: 4, // 3 points
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 3) return [];
    const [p0, p1, p2] = coordinates;
    const diff = p1.y - p0.y;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618];
    const figures: unknown[] = [];
    for (const level of levels) {
      const y = p2.y - diff * level;
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x: p0.x, y }, { x: p2.x + 100, y }] },
      });
      figures.push({
        type: 'text',
        attrs: { x: p2.x + 104, y, text: `${(level * 100).toFixed(1)}%`, align: 'left', baseline: 'middle' },
        styles: { color: '#CCCCCC', size: 10 },
      });
    }
    return figures;
  },
};

// --- Measure tool ---
const measureOverlay: OverlayTemplate = {
  name: 'sv_measure',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ overlay, coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const points = overlay.points;
    const figures: unknown[] = [
      { type: 'rect', attrs: { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) }, styles: { style: 'stroke_fill', color: 'rgba(255,255,255,0.05)', borderColor: '#888888' } },
    ];
    if (points.length >= 2) {
      const priceDiff = (points[1].value ?? 0) - (points[0].value ?? 0);
      const pct = points[0].value ? ((priceDiff / points[0].value) * 100).toFixed(2) : '0';
      const text = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pct}%)`;
      figures.push({
        type: 'text',
        attrs: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, text, align: 'center', baseline: 'middle' },
        styles: { color: priceDiff >= 0 ? '#FF4444' : '#00CC66', size: 12 },
      });
    }
    return figures;
  },
};

// Placeholder overlays for complex tools (Gann, Fibonacci variants, etc.)
// These use simplified implementations that can be enhanced later.
function createSimpleTwoPointOverlay(name: string): OverlayTemplate {
  return {
    name,
    totalStep: 3,
    needDefaultPointFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return [];
      return [
        { type: 'line', attrs: { coordinates: [coordinates[0], coordinates[1]] } },
        { type: 'text', attrs: { x: coordinates[1].x + 4, y: coordinates[1].y, text: name.replace('sv_', ''), align: 'left', baseline: 'middle' }, styles: { color: '#888888', size: 10 } },
      ];
    },
  };
}

const additionalOverlays: OverlayTemplate[] = [
  createSimpleTwoPointOverlay('sv_arc'),
  createSimpleTwoPointOverlay('sv_pitchfork'),
  createSimpleTwoPointOverlay('sv_regressionChannel'),
  createSimpleTwoPointOverlay('sv_fibFan'),
  createSimpleTwoPointOverlay('sv_fibArc'),
  createSimpleTwoPointOverlay('sv_fibTimezone'),
  createSimpleTwoPointOverlay('sv_gannAngle'),
  createSimpleTwoPointOverlay('sv_gannFan'),
  createSimpleTwoPointOverlay('sv_gannGrid'),
  createSimpleTwoPointOverlay('sv_gannSquare'),
  createSimpleTwoPointOverlay('sv_speedResistance'),
  createSimpleTwoPointOverlay('sv_percentLine'),
  createSimpleTwoPointOverlay('sv_cycleLine'),
];

/**
 * Register all custom overlays with KLineChart.
 * Call this once before creating any chart instance.
 */
export function registerCustomOverlays(): void {
  const allOverlays = [
    arrowOverlay,
    buyMarkOverlay,
    sellMarkOverlay,
    flatMarkOverlay,
    ellipseOverlay,
    fibExtensionOverlay,
    measureOverlay,
    ...additionalOverlays,
  ];

  for (const overlay of allOverlays) {
    registerOverlay(overlay);
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/chart/overlayMapping.ts src/chart/customOverlays.ts
git commit -m "feat: add overlay mapping and 20 custom overlay registrations"
```

---

## Task 4: Custom Indicators (FSL, MOST, ASI)

**Files:**
- Create: `src/chart/customIndicators.ts`

- [ ] **Step 1: Create custom indicator registrations**

These 3 indicators aren't built into KLineChart and need `registerIndicator()`. The calculation logic stays in the Python backend — the frontend just renders the pre-calculated data from the web worker. However, since KLineChart calculates indicators internally, we need to provide JS-based calc functions.

```typescript
// src/chart/customIndicators.ts
import { registerIndicator } from 'klinecharts';
import type { KLineData } from 'klinecharts';

/**
 * FSL (Fractal Stop Loss) — custom trend-following indicator.
 * Simplified JS calculation for KLineChart integration.
 */
function registerFSL(): void {
  registerIndicator({
    name: 'FSL',
    shortName: 'FSL',
    calcParams: [10],
    figures: [
      { key: 'fsl', title: 'FSL', type: 'line' },
    ],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 10;
      return dataList.map((_, i) => {
        if (i < period) return {};
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += dataList[j].close;
        }
        const sma = sum / period;
        // Simplified FSL: SMA with ATR offset
        let atrSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          atrSum += dataList[j].high - dataList[j].low;
        }
        const atr = atrSum / period;
        return { fsl: dataList[i].close > sma ? sma - atr * 0.5 : sma + atr * 0.5 };
      });
    },
  });
}

/**
 * MOST (Moving Stop) — trend indicator with trailing stop.
 */
function registerMOST(): void {
  registerIndicator({
    name: 'MOST',
    shortName: 'MOST',
    calcParams: [20, 3],
    figures: [
      { key: 'most', title: 'MOST', type: 'line' },
      { key: 'exma', title: 'ExMA', type: 'line' },
    ],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 20;
      const pct = (indicator.calcParams?.[1] as number) ?? 3;
      const multiplier = 2 / (period + 1);
      let ema = dataList[0]?.close ?? 0;
      let most = ema;
      let trend = 1;

      return dataList.map((d, i) => {
        if (i === 0) return { most: d.close, exma: d.close };
        ema = d.close * multiplier + ema * (1 - multiplier);
        const stop = ema * (1 - pct / 100);
        const resist = ema * (1 + pct / 100);
        if (trend === 1) {
          most = Math.max(most, stop);
          if (d.close < most) { trend = -1; most = resist; }
        } else {
          most = Math.min(most, resist);
          if (d.close > most) { trend = 1; most = stop; }
        }
        return { most, exma: ema };
      });
    },
  });
}

/**
 * ASI (Accumulative Swing Index).
 */
function registerASI(): void {
  registerIndicator({
    name: 'ASI',
    shortName: 'ASI',
    calcParams: [],
    figures: [
      { key: 'asi', title: 'ASI', type: 'line' },
    ],
    calc: (dataList: KLineData[]) => {
      let asi = 0;
      return dataList.map((d, i) => {
        if (i === 0) return { asi: 0 };
        const prev = dataList[i - 1];
        const c = d.close;
        const pc = prev.close;
        const o = d.open;
        const po = prev.open;
        const h = d.high;
        const l = d.low;
        const k = Math.max(Math.abs(h - pc), Math.abs(l - pc));
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        if (tr === 0) return { asi };
        const er = (Math.abs(h - pc) > Math.abs(l - pc))
          ? Math.abs(h - pc) + 0.5 * Math.abs(l - pc) + 0.25 * Math.abs(pc - po)
          : Math.abs(l - pc) + 0.5 * Math.abs(h - pc) + 0.25 * Math.abs(pc - po);
        const si = er !== 0 ? (50 * (c - pc + 0.5 * (c - o) + 0.25 * (pc - po)) / er * k / tr) : 0;
        asi += si;
        return { asi };
      });
    },
  });
}

/**
 * BRAR (BR + AR combined) — KLineChart has BR and AR separately,
 * but our app uses BRAR as a combined indicator.
 */
function registerBRAR(): void {
  registerIndicator({
    name: 'BRAR',
    shortName: 'BRAR',
    calcParams: [26],
    figures: [
      { key: 'br', title: 'BR', type: 'line' },
      { key: 'ar', title: 'AR', type: 'line' },
    ],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 26;
      return dataList.map((_, i) => {
        if (i < period) return {};
        let brUp = 0, brDown = 0, arUp = 0, arDown = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const prev = dataList[j - 1];
          brUp += Math.max(0, dataList[j].high - prev.close);
          brDown += Math.max(0, prev.close - dataList[j].low);
          arUp += dataList[j].high - dataList[j].open;
          arDown += dataList[j].open - dataList[j].low;
        }
        return {
          br: brDown !== 0 ? (brUp / brDown) * 100 : 0,
          ar: arDown !== 0 ? (arUp / arDown) * 100 : 0,
        };
      });
    },
  });
}

/**
 * Register all custom indicators with KLineChart.
 * Call this once before creating any chart instance.
 */
export function registerCustomIndicators(): void {
  registerFSL();
  registerMOST();
  registerASI();
  registerBRAR();
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/chart/customIndicators.ts
git commit -m "feat: register 4 custom indicators (FSL, MOST, ASI, BRAR)"
```

---

## Task 5: Wire Up ChartContainer

**Files:**
- Modify: `src/components/chart/ChartContainer.tsx`

This is the big integration task. We replace all LW Charts references with the single KLineChartWrapper.

- [ ] **Step 1: Rewrite ChartContainer.tsx**

Key changes:
1. Remove all LW Charts imports (`IChartApi`, `ISeriesApi`, `lightweight-charts`)
2. Remove `KLineChart`, `VolumeChart`, `IndicatorChart` component imports
3. Remove `Crosshair`, `useCrosshairSync`, `useWheelZoom`, `useChartSync` imports
4. Add single `KLineChartWrapper` import
5. Replace 4 chart refs with 1 KLineChartWrapper ref
6. Remove crosshair sync, wheel zoom, chart sync hooks
7. Remove DrawingCanvas (drawings now handled by KLineChart overlays)
8. Keep all dialog state and toolbar unchanged

Replace ChartContainer.tsx with:

```typescript
// src/components/chart/ChartContainer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { KLineChartWrapper, type KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { ChartSettingsDialog } from '@/components/chart/ChartSettingsDialog';
import { PriceScaleDialog } from '@/components/chart/PriceScaleDialog';
import { DrawingContextMenu } from '@/components/chart/DrawingContextMenu';
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

  // Load persisted settings on mount
  useEffect(() => { void fetchSettings(); }, [fetchSettings]);

  // Update rightOffset when period changes
  useEffect(() => {
    setRightOffset(getDefaultRightOffset(currentPeriod));
  }, [currentPeriod, setRightOffset]);

  // Compute start date from displayDays
  const getStartDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - displayDays);
    return d.toISOString().slice(0, 10);
  }, [displayDays]);

  // Initial data load
  useEffect(() => {
    const start = getStartDate();
    const end = new Date().toISOString().slice(0, 10);
    void fetchKlineInitial(currentCode, currentMarket, currentPeriod, start, end);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, currentMarket, currentPeriod, displayDays]);

  // Load drawings on stock/period change
  useEffect(() => {
    void loadDrawings(currentCode, currentPeriod);
  }, [currentCode, currentPeriod, loadDrawings]);

  // Dialog management
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

  // Keyboard shortcuts — adapted for KLineChart
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
      {/* Chart toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 24, padding: '0 4px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <button
          style={{ ...toolbarBtnStyle, color: inWatchlist ? '#FFD700' : 'var(--text-secondary)' }}
          onClick={() => toggleCode(currentCode)}
          title={inWatchlist ? '移出自选' : '加入自选'}
        >⭐自选</button>
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

      {/* Single KLineChart instance — fills remaining space */}
      <div
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <KLineChartWrapper ref={chartWrapperRef} />
        {showDrawingToolbar && <DrawingToolbar />}
        {ctxMenu && (
          <DrawingContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>

      {/* Indicator tab bar (always visible, KLineChart handles pane hiding internally) */}
      <IndicatorTabBar />

      {/* Dialogs */}
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
```

- [ ] **Step 2: Verify typecheck (expect errors from useKeyboardShortcuts signature change)**

Run: `cd D:/stockvision && npx tsc --noEmit`

This will fail because `useKeyboardShortcuts` still expects the old interface. That's addressed in Task 6.

- [ ] **Step 3: Commit (WIP)**

```bash
git add src/components/chart/ChartContainer.tsx
git commit -m "refactor: rewrite ChartContainer for KLineChart integration (WIP)"
```

---

## Task 6: Adapt useKeyboardShortcuts

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Rewrite useKeyboardShortcuts for KLineChart API**

Replace the old interface that takes multiple chart refs with a single `KLineChartWrapperHandle` ref.

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useRef } from 'react';
import type { KLineChartWrapperHandle } from '@/components/chart/KLineChartWrapper';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDrawingStore } from '@/stores/drawingStore';

interface Options {
  chartWrapper: React.RefObject<KLineChartWrapperHandle | null>;
  onRefresh: () => void;
  onStockInfo: () => void;
  anyDialogOpen: boolean;
  onCloseDialog: () => void;
  onEnterCode: () => void;
}

export function useKeyboardShortcuts({
  chartWrapper,
  onRefresh,
  onStockInfo,
  anyDialogOpen,
  onCloseDialog,
  onEnterCode,
}: Options): void {
  const optsRef = useRef({
    chartWrapper,
    onRefresh,
    onStockInfo,
    anyDialogOpen,
    onCloseDialog,
    onEnterCode,
  });
  useEffect(() => {
    optsRef.current = { chartWrapper, onRefresh, onStockInfo, anyDialogOpen, onCloseDialog, onEnterCode };
  });

  const keyboardNavRef = useRef(false);

  // Exit keyboard nav mode on mouse move/click
  useEffect(() => {
    const exitNavMode = () => {
      if (keyboardNavRef.current) {
        keyboardNavRef.current = false;
        useCrosshairStore.getState().clear();
      }
    };
    window.addEventListener('mousemove', exitNavMode);
    window.addEventListener('click', exitNavMode);
    return () => {
      window.removeEventListener('mousemove', exitNavMode);
      window.removeEventListener('click', exitNavMode);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const {
        chartWrapper: cwRef,
        onRefresh: refresh,
        onStockInfo: stockInfo,
        anyDialogOpen: dialogOpen,
        onCloseDialog: closeDialog,
        onEnterCode: enterCode,
      } = optsRef.current;

      const chart = cwRef.current?.chart;

      // --- Esc: cancel drawing, close dialog, or return to market view ---
      if (e.key === 'Escape') {
        const { activeTool, pendingPoints, setActiveTool, clearPending } = useDrawingStore.getState();
        if (pendingPoints.length > 0) { clearPending(); e.preventDefault(); return; }
        if (activeTool) { setActiveTool(null); e.preventDefault(); return; }
        if (dialogOpen) { closeDialog(); e.preventDefault(); return; }
        const chartState = useChartStore.getState();
        if (chartState.activeView === 'chart') {
          chartState.setActiveView('market');
          e.preventDefault();
        }
        return;
      }

      if (inInput) return;

      // --- F5: refresh ---
      if (e.key === 'F5') { e.preventDefault(); refresh(); return; }

      // --- F6: toggle chart / market view ---
      if (e.key === 'F6') {
        e.preventDefault();
        const cs = useChartStore.getState();
        cs.setActiveView(cs.activeView === 'chart' ? 'market' : 'chart');
        return;
      }

      // --- F10: stock info ---
      if (e.key === 'F10') { e.preventDefault(); stockInfo(); return; }

      // --- Enter: code input ---
      if (e.key === 'Enter') { e.preventDefault(); enterCode(); return; }

      // --- Ctrl+Z: undo last drawing ---
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const { drawings, removeDrawing } = useDrawingStore.getState();
        if (drawings.length > 0) removeDrawing(drawings[drawings.length - 1].id);
        return;
      }

      // --- Delete: remove selected drawing ---
      if (e.key === 'Delete') {
        e.preventDefault();
        const { selectedId, removeDrawing } = useDrawingStore.getState();
        if (selectedId) removeDrawing(selectedId);
        return;
      }

      // --- Arrow Left/Right: move crosshair one bar ---
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const { activeBarIndex } = useCrosshairStore.getState();
        const currentCandles = useDataStore.getState().candles;
        if (!currentCandles.length || !chart) { e.preventDefault(); return; }

        keyboardNavRef.current = true;
        const startIdx = activeBarIndex ?? currentCandles.length - 1;
        let nextIndex = startIdx;
        if (e.key === 'ArrowLeft') nextIndex = Math.max(0, startIdx - 1);
        if (e.key === 'ArrowRight') nextIndex = Math.min(currentCandles.length - 1, startIdx + 1);

        // Use KLineChart's scrollToDataIndex for auto-scroll
        chart.scrollToDataIndex(nextIndex);

        // Execute crosshair action to show crosshair at this bar
        const klineData = chart.getDataList();
        if (klineData[nextIndex]) {
          chart.executeAction('onCrosshairChange', {
            dataIndex: nextIndex,
            kLineData: klineData[nextIndex],
          });
        }

        useCrosshairStore.getState().setPosition({ activeBarIndex: nextIndex });
        e.preventDefault();
        return;
      }

      // --- Arrow Up: zoom in (hide panels progressively) ---
      if (e.key === 'ArrowUp') {
        const { zoomLevel, setZoomLevel } = useChartStore.getState();
        if (zoomLevel < 2) setZoomLevel((zoomLevel + 1) as 0 | 1 | 2);
        e.preventDefault();
        return;
      }
      // --- Arrow Down: zoom out (restore panels progressively) ---
      if (e.key === 'ArrowDown') {
        const { zoomLevel, setZoomLevel } = useChartStore.getState();
        if (zoomLevel > 0) setZoomLevel((zoomLevel - 1) as 0 | 1 | 2);
        e.preventDefault();
        return;
      }

      // --- PageUp: zoom in (fewer bars) ---
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (chart) chart.zoomAtCoordinate(1.4); // 1.4x zoom in
        return;
      }

      // --- PageDown: zoom out (more bars) ---
      if (e.key === 'PageDown') {
        e.preventDefault();
        if (chart) chart.zoomAtCoordinate(0.7); // 0.7x zoom out
        return;
      }

      // --- Home: jump to earliest data ---
      if (e.key === 'Home') {
        e.preventDefault();
        if (chart) chart.scrollToDataIndex(0);
        return;
      }

      // --- End: jump to latest data ---
      if (e.key === 'End') {
        e.preventDefault();
        if (chart) chart.scrollToRealTime();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts
git commit -m "refactor: adapt useKeyboardShortcuts for KLineChart API"
```

---

## Task 7: Register Custom Code at App Entry

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Add registration calls before React render**

```typescript
// Add to the TOP of src/main.tsx, before ReactDOM.createRoot:
import { registerCustomIndicators } from '@/chart/customIndicators';
import { registerCustomOverlays } from '@/chart/customOverlays';

// Register custom indicators and overlays before chart init
registerCustomIndicators();
registerCustomOverlays();

// ... existing React render code stays the same
```

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: register custom indicators and overlays at app start"
```

---

## Task 8: Simplify CrosshairStore

**Files:**
- Modify: `src/stores/crosshairStore.ts`

- [ ] **Step 1: Simplify crosshairStore**

Remove fields that KLineChart now handles natively (snapX, mouseY, priceAtY, timeLabel, activeChart). Keep only what's needed for keyboard navigation.

```typescript
// src/stores/crosshairStore.ts
import { create } from 'zustand';

interface CrosshairState {
  /** Index of the currently highlighted bar (keyboard navigation) */
  activeBarIndex: number | null;
  /** Whether we're in keyboard navigation mode */
  isKeyboardNavMode: boolean;
}

interface CrosshairActions {
  setPosition: (pos: { activeBarIndex: number }) => void;
  setKeyboardNavMode: (mode: boolean) => void;
  clear: () => void;
}

export const useCrosshairStore = create<CrosshairState & CrosshairActions>((set) => ({
  activeBarIndex: null,
  isKeyboardNavMode: false,
  setPosition: (pos) => set({ activeBarIndex: pos.activeBarIndex }),
  setKeyboardNavMode: (mode) => set({ isKeyboardNavMode: mode }),
  clear: () => set({ activeBarIndex: null, isKeyboardNavMode: false }),
}));
```

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

Fix any remaining references to old crosshairStore fields across the codebase (InfoTooltip, Crosshair.tsx, etc. — these are being deleted anyway).

- [ ] **Step 3: Commit**

```bash
git add src/stores/crosshairStore.ts
git commit -m "refactor: simplify crosshairStore for KLineChart native crosshair"
```

---

## Task 9: Delete Old Files

**Files:**
- Delete: `src/components/chart/KLineChart.tsx`
- Delete: `src/components/chart/VolumeChart.tsx`
- Delete: `src/components/chart/Crosshair.tsx`
- Delete: `src/components/chart/InfoTooltip.tsx`
- Delete: `src/hooks/useCrosshairSync.ts`
- Delete: `src/hooks/useWheelZoom.ts`
- Delete: `src/hooks/useChartSync.ts`
- Delete: `src/theme/darkTheme.ts`
- Delete: `src/workers/indicator.worker.ts`

- [ ] **Step 1: Delete old LW Charts components and hooks**

```bash
cd D:/stockvision
rm src/components/chart/KLineChart.tsx
rm src/components/chart/VolumeChart.tsx
rm src/components/chart/Crosshair.tsx
rm src/components/chart/InfoTooltip.tsx
rm src/hooks/useCrosshairSync.ts
rm src/hooks/useWheelZoom.ts
rm src/hooks/useChartSync.ts
rm src/theme/darkTheme.ts
rm src/workers/indicator.worker.ts
```

- [ ] **Step 2: Fix remaining imports**

Search for any remaining imports of deleted files and remove them. Key files to check:
- `src/components/chart/ChartContainer.tsx` — already updated in Task 5
- `src/components/chart/IndicatorChart.tsx` — still imported by `FormulaSeries` type

The `FormulaSeries` type is used in ChartContainer for the FormulaEditor. Move it to a shared types file:

```typescript
// Add to src/types/tooltip.ts (or create src/types/chart.ts)
export interface FormulaSeries {
  name: string;
  data: { time: number; value: number }[];
}
```

Update ChartContainer's import to use the new location.

- [ ] **Step 3: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

Fix ALL remaining errors. Common issues:
- Old `IChartApi` / `ISeriesApi` imports → remove
- `lightweight-charts` imports → remove
- `darkChartOptions` / `candleColors` references → replace with klineTheme equivalents

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete old LW Charts components, hooks, and theme"
```

---

## Task 10: DrawingCanvas Migration

**Files:**
- Modify: `src/components/chart/DrawingCanvas.tsx` (major rewrite or delete)

The old DrawingCanvas (1,315 lines) uses HTML5 canvas to render drawings manually. KLineChart handles overlay rendering natively. We need to bridge `drawingStore` → KLineChart overlays.

- [ ] **Step 1: Replace DrawingCanvas with a bridge component**

Instead of rendering on canvas, this component watches `drawingStore` and creates/removes KLineChart overlays accordingly.

```typescript
// src/components/chart/DrawingBridge.tsx
import { useEffect, useRef } from 'react';
import type { Chart } from 'klinecharts';
import { useDrawingStore, type Drawing } from '@/stores/drawingStore';
import { getOverlayName } from '@/chart/overlayMapping';

interface DrawingBridgeProps {
  chart: Chart | null;
}

/**
 * Bridge between drawingStore and KLineChart overlays.
 * Watches drawingStore.drawings and syncs to chart overlays.
 */
export function DrawingBridge({ chart }: DrawingBridgeProps): null {
  const drawings = useDrawingStore((s) => s.drawings);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const selectedId = useDrawingStore((s) => s.selectedId);
  const prevDrawingIdsRef = useRef<Set<string>>(new Set());

  // Sync drawings to chart overlays
  useEffect(() => {
    if (!chart) return;

    const currentIds = new Set(drawings.map((d) => d.id));
    const prevIds = prevDrawingIdsRef.current;

    // Remove overlays that no longer exist in store
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        chart.removeOverlay({ id });
      }
    }

    // Add or update overlays
    for (const drawing of drawings) {
      if (!prevIds.has(drawing.id)) {
        // New drawing — create overlay
        const overlayName = getOverlayName(drawing.type);
        const points = drawing.points.map((p) => ({
          timestamp: p.time * 1000, // our store uses seconds, KLineChart uses ms
          value: p.price,
        }));

        chart.createOverlay({
          id: drawing.id,
          name: overlayName,
          points,
          lock: drawing.locked ?? false,
          visible: true,
          styles: {
            line: {
              color: drawing.style.color,
              size: drawing.style.lineWidth,
              style: drawing.style.lineStyle === 'dashed' ? 'dashed' : 'solid',
            },
          },
          onRightClick: (event) => {
            // Will be handled by DrawingContextMenu
            useDrawingStore.getState().setSelectedId(drawing.id);
            return false; // allow default context menu
          },
          onSelected: () => {
            useDrawingStore.getState().setSelectedId(drawing.id);
          },
          onDeselected: () => {
            const store = useDrawingStore.getState();
            if (store.selectedId === drawing.id) {
              store.setSelectedId(null);
            }
          },
        });
      }
    }

    prevDrawingIdsRef.current = currentIds;
  }, [drawings, chart]);

  // Handle active drawing tool — enable overlay creation mode
  useEffect(() => {
    if (!chart) return;

    if (activeTool) {
      const overlayName = getOverlayName(activeTool);
      chart.createOverlay({
        name: overlayName,
        onDrawEnd: (event) => {
          // Save to drawingStore when drawing is complete
          const overlay = event.overlay;
          const points = overlay.points.map((p) => ({
            time: Math.floor((p.timestamp ?? 0) / 1000),
            price: p.value ?? 0,
          }));
          const store = useDrawingStore.getState();
          store.commitDrawing({
            id: overlay.id,
            type: activeTool,
            points,
            style: store.defaultStyle ?? { color: '#FFFFFF', lineWidth: 1, lineStyle: 'solid' },
          });
        },
      });
    }
  }, [activeTool, chart]);

  return null; // This component renders nothing — it's a sync bridge
}
```

- [ ] **Step 2: Delete old DrawingCanvas.tsx**

```bash
rm D:/stockvision/src/components/chart/DrawingCanvas.tsx
```

- [ ] **Step 3: Update ChartContainer to use DrawingBridge**

Add `<DrawingBridge chart={chartWrapperRef.current?.chart ?? null} />` inside the chart area div.

- [ ] **Step 4: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace DrawingCanvas with KLineChart overlay bridge"
```

---

## Task 11: BacktestResult Migration

**Files:**
- Modify: `src/components/chart/BacktestResult.tsx`

- [ ] **Step 1: Replace D3 equity curve with KLineChart**

The BacktestResult component currently uses D3 for the equity curve chart. Replace with a small KLineChart instance for consistency.

In `BacktestResult.tsx`, find the D3 equity curve rendering section and replace with:

```typescript
// Replace the D3 SVG equity curve section with:
import { init as initKChart, dispose as disposeKChart } from 'klinecharts';
import { darkStyles } from '@/theme/klineTheme';

// Inside the component, replace the D3 useEffect + SVG with:
const equityChartRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = equityChartRef.current;
  if (!el || !data?.equityCurve?.length) return;

  const chart = initKChart(el, {
    styles: darkStyles as never,
  });
  if (!chart) return;

  // Convert equity curve to KLineData format
  const klineData = data.equityCurve.map((ep) => ({
    timestamp: new Date(ep.date).getTime(),
    open: ep.equity,
    high: ep.equity,
    low: ep.equity,
    close: ep.equity,
    volume: 0,
  }));

  chart.resetData();
  const dataList = chart.getDataList();
  dataList.push(...klineData);
  chart.resize();

  // Add buy/sell markers from trades
  if (data.trades?.length) {
    for (const trade of data.trades) {
      chart.createOverlay({
        name: 'sv_buyMark',
        points: [{ timestamp: new Date(trade.entry_date).getTime(), value: trade.entry_price }],
      });
      chart.createOverlay({
        name: 'sv_sellMark',
        points: [{ timestamp: new Date(trade.exit_date).getTime(), value: trade.exit_price }],
      });
    }
  }

  return () => disposeKChart(el);
}, [data]);

// In the JSX, replace the D3 SVG element with:
// <div ref={equityChartRef} style={{ width: '100%', height: 200 }} />
```

- [ ] **Step 2: Remove D3 import if no longer used elsewhere in this file**

Check if `d3` is used for anything else in BacktestResult.tsx. If only for the equity curve, remove the import. Note: D3 is still used by SectorHeatmap.tsx, so don't remove from package.json.

- [ ] **Step 3: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/chart/BacktestResult.tsx
git commit -m "refactor: migrate BacktestResult equity curve to KLineChart"
```

---

## Task 12: Update IndicatorChart (keep as IndicatorParamsDialog host)

**Files:**
- Modify or Delete: `src/components/chart/IndicatorChart.tsx`

The old IndicatorChart component created a separate LW Charts instance. Since KLineChart now manages indicator panes natively, IndicatorChart.tsx can be deleted. However, the `IndicatorParamsDialog` integration and `FormulaSeries` type need to be preserved.

- [ ] **Step 1: Move FormulaSeries type**

Create or update a shared types file:

```typescript
// src/types/chart.ts
export interface FormulaSeries {
  name: string;
  data: { time: number; value: number }[];
}
```

- [ ] **Step 2: Update all FormulaSeries imports**

Replace `import type { FormulaSeries } from '@/components/chart/IndicatorChart'` with `import type { FormulaSeries } from '@/types/chart'` in:
- `src/components/chart/ChartContainer.tsx`

- [ ] **Step 3: Wire IndicatorParamsDialog to KLineChart**

In KLineChartWrapper, add right-click handling for indicator panes that opens IndicatorParamsDialog. Add a callback prop:

```typescript
// Add to KLineChartWrapper props:
interface KLineChartWrapperProps {
  onIndicatorRightClick?: (section: 'upper' | 'lower') => void;
}

// In the init effect, after creating indicator panes:
// Subscribe to indicator tooltip feature click for params dialog
chart.subscribeAction('onIndicatorTooltipFeatureClick', (data: unknown) => {
  // Determine which pane was clicked and trigger params dialog
});
```

- [ ] **Step 4: Delete IndicatorChart.tsx**

```bash
rm D:/stockvision/src/components/chart/IndicatorChart.tsx
```

- [ ] **Step 5: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move FormulaSeries type, delete IndicatorChart.tsx"
```

---

## Task 13: Update DrawingContextMenu for KLineChart

**Files:**
- Modify: `src/components/chart/DrawingContextMenu.tsx`

- [ ] **Step 1: Update context menu to work with KLineChart overlays**

The existing context menu reads from drawingStore which still works. The main change is wiring lock/unlock to KLineChart's `overrideOverlay()`:

```typescript
// In the lock handler, add:
const chart = chartWrapperRef?.current?.chart;
if (chart && selectedId) {
  chart.overrideOverlay({ id: selectedId, lock: !drawing.locked });
}
```

The DrawingContextMenu needs access to the chart ref. Pass it via props or context.

- [ ] **Step 2: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/chart/DrawingContextMenu.tsx
git commit -m "refactor: wire DrawingContextMenu to KLineChart overlay API"
```

---

## Task 14: Remove lightweight-charts Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove lightweight-charts**

```bash
cd D:/stockvision && npm uninstall lightweight-charts
```

- [ ] **Step 2: Search for any remaining lightweight-charts imports**

```bash
grep -r "lightweight-charts" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references.

- [ ] **Step 3: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`
Expected: PASS with zero errors

- [ ] **Step 4: Verify full test suite**

Run: `npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove lightweight-charts dependency"
```

---

## Task 15: Version Bump + Final Cleanup

**Files:**
- Modify: `package.json` (version)
- Modify: `src-tauri/Cargo.toml` (version)
- Modify: `src-tauri/tauri.conf.json` (version)

- [ ] **Step 1: Bump version to 0.4.0**

Update version in all 3 files from `0.3.1` to `0.4.0`:
- `package.json` line 3
- `src-tauri/Cargo.toml` line 3
- `src-tauri/tauri.conf.json` line 4

- [ ] **Step 2: Run full verification**

```bash
cd D:/stockvision && npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..
```

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.4.0 for KLineChart migration"
```

---

## Task 16: Data Loading Integration (DataLoader API)

**Files:**
- Modify: `src/components/chart/KLineChartWrapper.tsx`

KLineChart v10 uses a `DataLoader` API for dynamic data loading. We need to wire our `dataStore` lazy loading to this.

- [ ] **Step 1: Implement DataLoader in KLineChartWrapper**

Add a DataLoader that connects to our existing dataStore fetch functions:

```typescript
// Inside KLineChartWrapper's init effect, after creating the chart:
chart.setDataLoader({
  getBars: async (params) => {
    const { type, callback } = params;
    const store = useDataStore.getState();

    if (type === 'init') {
      // Initial load — use existing fetchKlineInitial
      const chartState = useChartStore.getState();
      const settingsState = useChartSettingsStore.getState();
      const d = new Date();
      d.setDate(d.getDate() - settingsState.displayDays);
      const start = d.toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      await store.fetchKlineInitial(
        chartState.currentCode,
        chartState.currentMarket,
        chartState.currentPeriod,
        start,
        end,
      );
      const klineData = toKLineData(store.candles);
      callback(klineData, { backward: !store.allLoaded });
    } else if (type === 'backward') {
      // Lazy load — fetch older bars
      if (store.allLoaded || store.loadingMore) {
        callback([], false);
        return;
      }
      await store.fetchMoreBars();
      const klineData = toKLineData(store.candles);
      callback(klineData, { backward: !store.allLoaded });
    } else {
      callback([], false);
    }
  },
});
```

- [ ] **Step 2: Remove the manual data feeding effect**

Remove the `useEffect` that directly manipulates `chart.getDataList()` — the DataLoader handles this now.

- [ ] **Step 3: Verify typecheck**

Run: `cd D:/stockvision && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/chart/KLineChartWrapper.tsx
git commit -m "feat: integrate DataLoader for lazy loading in KLineChartWrapper"
```

---

## Task 17: Smoke Test + Fix Remaining Issues

- [ ] **Step 1: Run dev server and visually verify**

```bash
cd D:/stockvision && npm run dev
```

Open http://localhost:1420 in browser. Check:
1. ✅ Chart renders with candlesticks + MA lines
2. ✅ Volume pane shows below main chart
3. ✅ MACD pane shows below volume
4. ✅ Crosshair follows mouse across all panes
5. ✅ Arrow keys navigate bars
6. ✅ PageUp/PageDown zoom in/out
7. ✅ Home/End jump to start/end
8. ✅ Drawing toolbar shows and tools work
9. ✅ Right-click context menu works
10. ✅ Indicator tab bar switches indicators
11. ✅ F5 refreshes, F6 toggles view

- [ ] **Step 2: Fix any visual/functional issues**

Document and fix each issue found during smoke testing.

- [ ] **Step 3: Run final verification**

```bash
npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve smoke test issues from KLineChart migration"
```

---

## Dependency Graph

```
Task 1 (Data Adapter + Theme) ──┐
                                 ├── Task 2 (KLineChartWrapper)
Task 3 (Overlay Mapping) ───────┤
Task 4 (Custom Indicators) ─────┘
                                 │
                                 ├── Task 5 (ChartContainer rewrite)
                                 │        │
                                 │        ├── Task 6 (useKeyboardShortcuts)
                                 │        │
                                 │        └── Task 7 (Register at entry)
                                 │
                                 ├── Task 8 (Simplify CrosshairStore)
                                 │
                                 ├── Task 9 (Delete old files)
                                 │        │
                                 │        ├── Task 10 (DrawingCanvas → DrawingBridge)
                                 │        │
                                 │        ├── Task 11 (BacktestResult migration)
                                 │        │
                                 │        └── Task 12 (IndicatorChart deletion)
                                 │
                                 ├── Task 13 (DrawingContextMenu update)
                                 │
                                 ├── Task 14 (Remove LW Charts dep)
                                 │
                                 ├── Task 15 (Version bump)
                                 │
                                 ├── Task 16 (DataLoader integration)
                                 │
                                 └── Task 17 (Smoke test)
```

Tasks 1, 3, 4 can run in parallel. Tasks 5-8 depend on 1-4. Tasks 9-13 depend on 5-8. Tasks 14-17 are sequential at the end.
