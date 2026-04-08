---
title: StockVision Progress
tags: planning, stockvision, progress
created: 2026-04-07
---

# StockVision - Progress Log

## 2026-04-07 — Project Kickoff

- [x] 读取技术规格文档 (StockVision_TechSpec.docx)
- [x] Brainstorming 完成 — 确认独立项目，data adapter 层，EXE 分发
- [x] 设计确认 — 新增通达信本地文件支持，Phase gate 测试要求
- [x] 创建项目文件夹 `01-projects/stockvision/`
- [x] 写入 design-spec.md
- [x] 创建 planning files (task_plan.md, findings.md, progress.md)
- [ ] 设置 Ralph loop
- [ ] 保存 project memory

### Key Decisions
- 数据源: API (AKShare/Tushare) + 通达信本地文件 (.day/.5/.1) 都要支持
- 分发: EXE/MSI 一键安装 (爸爸是老人不会 Docker)
- Phase gate: 每阶段测试通过才进下一阶段，写进 Ralph loop

### Next Steps
- 设置 Ralph loop (含 phase gate 测试)
- 开始 Phase 1: Tauri + React 初始化

## 2026-04-08 — P2-3: 右侧空白 + 上方空白

### What was built
- **Backend**: Added `config` table to SQLite in `storage.py` (save/load/load_all functions). New `api/config.py` router with `GET /api/config` and `PUT /api/config/{key}`. Registered in `main.py`.
- **Frontend**: `chartSettingsStore.ts` (Zustand) with `rightOffset`, `displayDays`, `priceScaleMode`, `priceMin`, `priceMax`. Fetches/saves to backend config API.
- **ChartSettingsDialog**: modal dialog for rightOffset + displayDays settings.
- **PriceScaleDialog**: 坐标设置 dialog with auto/manual toggle and min/max price inputs.
- **Charts updated**: KLineChart/VolumeChart/IndicatorChart all apply `rightOffset` from store via `applyOptions`. KLineChart applies price scale via `autoscaleInfoProvider`.
- **ChartContainer**: monitors `visibleLogicalRangeChange` to track rightOffset from user drag; re-fetches with displayDays-computed start date; shows "坐标"/"设置" buttons.
- **dataStore**: `fetchKline` now accepts optional `start`/`end` params.

### Key patterns learned
- LW Charts `autoscaleInfoProvider` on series is the way to set fixed price range in v4
- `subscribeVisibleLogicalRangeChange` can detect rightOffset changes (range.to - dataLength gives offset)
- Config persistence: simple key/value SQLite table, all stored as strings

## 2026-04-08 — P2-4: 右侧信息面板 InfoPanel

### What was built
- **InfoPanel.tsx**: Right-side panel with three sections: MarketSummary, TickList, SectorLinks
- **MarketSummary**: Shows latest price, open, prev close, change%, volume, amount, high, low from last candle in dataStore
- **TickList**: Shows last 30 candles (newest first) as scrollable tick list with time/price/volume columns; red for up, green for down
- **SectorLinks**: 12 fixed sector quick-link buttons in 2-column grid layout
- **Collapse/expand**: Header button toggles panel content visibility
- **InfoPanel.module.css**: All colors use CSS variables, no hardcoded hex

### Key patterns learned
- InfoPanel reads directly from Zustand stores (dataStore + chartStore) — no new API needed for this phase
- TickList uses recent candles as proxy for real tick data (acceptable for Phase 2 scope)
- Collapse/expand managed with local `useState` in InfoPanel — no need for global store

## 2026-04-08 — P3-1: 画线引擎架构

### What was built
- **`drawingStore.ts`**: Zustand store with `Drawing`/`DrawingPoint`/`DrawingStyle` types. Drawings stored as `{time: number (UTCTimestamp), price: number}`. `activeTool`, `activeStyle`, `pendingPoints`, `commitDrawing`, `removeDrawing`, `clearAll`.
- **`DrawingCanvas.tsx`**: `<canvas>` with `position: absolute` overlaying the K-line chart area. Reads chart/series from props. Coordinate conversion: `chart.timeScale().timeToCoordinate(time as Time)` / `series.priceToCoordinate(price)` for rendering; `coordinateToTime`/`coordinateToPrice` for mouse → point. Subscribes to `subscribeVisibleLogicalRangeChange` + `ResizeObserver` for redraws on scroll/zoom/resize. Mouse handlers: 1-click for horizontal/vertical, 2-click for trendline/ray/segment/rectangle. Preview line rendered while placing second point.
- **`ChartContainer.tsx`**: Imports `DrawingCanvas`, adds `drawingChart`/`drawingSeries` state derived from `candles` (ensures charts are mounted), passes to `DrawingCanvas`.

### Key patterns learned
- Pass chart/series as state (not refs) to `DrawingCanvas` — use `useState` updated in a `useEffect([candles])` to ensure refs are populated after chart mounts
- Store drawings as `UTCTimestamp` (number), cast to `Time` when calling LW Charts API
- Canvas sizing: compare `getBoundingClientRect()` dims to `canvas.width/height` each redraw; reset to 0 to force full resize on ResizeObserver fire
- Future blank area works automatically — LW Charts time scale extrapolates beyond last data point

## 2026-04-08 — P3-2: 画线工具栏 DrawingToolbar

### What was built
- **`DrawingToolbar.tsx`**: Floating `position: absolute` panel in the K-line chart area (top-left, z-index 100)
- **Tool grid**: 7-column grid with 13 tools: trendline/ray/segment/horizontal/vertical/channel/fibRetracement/gannAngle/rectangle/text/buyMark/sellMark/flatMark
- **Cursor button**: ↖ cancels active tool (`setActiveTool(null)`)
- **Color picker**: `<input type="color">` bound to `activeStyle.color`
- **Line style row**: solid/dashed/dotted buttons
- **Line width row**: 1-5px buttons
- **Active state**: highlighted with `--color-up` background
- **`drawingStore.ts`**: Added `gannAngle | buyMark | sellMark | flatMark` to `DrawingToolType`

### Key patterns learned
- Active tool toggle: `setActiveTool(activeTool === t.type ? null : t.type)` — clicking the active tool deselects it
- `<input type="color">` works natively in Tauri WebView, no library needed
- The toolbar is positioned inside the K-line area div which already has `position: relative`

## 2026-04-08 — P3-3: 各工具实现 (20+ tools)

### What was built
- **Trendline**: now extends through both p0 and p1 to canvas edges in both directions (via `extendLineFull`)
- **Ray**: extends from p0 in direction of p1 to canvas edge (via `extendRay`)
- **Channel**: 3-click tool — first two clicks define main trendline, third click defines parallel line offset (perpendicular projection). Dashed connecting lines shown for visual clarity
- **Fibonacci retracement**: 2-click tool — draws 7 horizontal lines at 0/23.6/38.2/50/61.8/78.6/100% with percentage labels on right edge. 50% and 61.8% rendered in gold for emphasis
- **Gann angle**: 2-click tool — anchor + direction click. Draws 3 lines (1×2, 1×1, 2×1) from anchor using canvas pixel slopes, labeled at ends
- **Rectangle**: was already done (semi-transparent fill)
- **Text**: 1-click + `window.prompt("输入文字:")` for text input; draws text with semi-transparent black background
- **Buy/Sell/Flat marks**: 1-click tools — buyMark shows upward triangle with "B", sellMark shows downward triangle with "S", flatMark shows circle with "=" and horizontal bars
- **Esc key**: cancels pending points first, then cancels active tool
- **Preview**: channel shows parallel line preview when placing 3rd point; trendline/ray show extended preview

### Key patterns learned
- `extendRay(p0, dx, dy, w, h)` → finds canvas-edge intersection in given direction
- `extendLineFull(p0, p1, w, h)` → extends line through both points to both canvas edges
- Channel parallel offset = perpendicular projection of p2 onto the normal of p0→p1
- `window.prompt()` works synchronously in Tauri WebView for text input
- For 1-click marks (buyMark/sellMark/flatMark), use same pattern as horizontal/vertical

## 2026-04-08 — P2-GATE: Phase 2 Gate

### Verification
- TypeScript: 0 errors
- Python tests: 13/13 passed
- All P2 tasks (P2-1 through P2-4) confirmed passing

### Gate criteria met
- Crosshair + tooltip (P2-1) ✓
- Wheel zoom (P2-2) ✓
- Right blank/price scale settings with SQLite persistence (P2-3) ✓
- InfoPanel with MarketSummary, TickList, SectorLinks (P2-4) ✓
