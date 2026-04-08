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
