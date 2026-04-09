# Findings & Decisions

## Requirements
- Replace Lightweight Charts 4.x with KLineChart 10.x
- Preserve ALL existing features (user: "确保现有的功能不会消失")
- Delete ~2000 lines of manual chart sync code
- Execute via Ralph loop with self-verification
- Double audit features against history before executing

## Research Findings

### KLineChart v10 API (from node_modules/klinecharts/dist/index.d.ts)
- `init(dom, options)` → Chart instance
- `chart.createIndicator(name, isStack, paneOptions)` → paneId string
- `chart.createOverlay(config)` → overlay id
- `chart.setDataLoader({ getBars })` → lazy loading
- `chart.scrollToDataIndex(idx)` → navigation
- `chart.zoomAtCoordinate(scale)` → zoom
- `chart.executeAction('onCrosshairChange', data)` → programmatic crosshair
- `chart.subscribeAction(type, callback)` → event subscription
- `chart.setPaneOptions({ id, state: 'minimize'|'normal' })` → hide/show panes
- `chart.convertToPixel/convertFromPixel` → coordinate conversion
- `registerIndicator(template)` → custom indicators
- `registerOverlay(template)` → custom overlays

### KLineChart Data Format
```typescript
interface KLineData {
  timestamp: number;   // milliseconds (NOT seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  turnover?: number;
}
```

### Built-in Indicators (26)
MA, EMA, SMA, DMA, TRIX, BIAS, BBI, CCI, CR, DMI, AR, BR,
RSI, KDJ, MACD, STOCH, MTM, ROC, PSY, WR, VOL, OBV, VR, AO, EMV, PVT, AVP, SAR

### Built-in Overlays (20+)
line, straightLine, rayLine, segment, parallelStraightLine,
horizontalStraightLine, verticalStraightLine, horizontalRayLine, verticalRayLine,
horizontalSegment, verticalSegment, rect, polygon, circle, arc, text,
priceLine, priceChannelLine, fibonacciLine, simpleTag, simpleAnnotation

### Feature Audit Results
| Category | Total | KLineChart Native | Custom Needed |
|----------|-------|-------------------|---------------|
| Indicators | 22 | 19 | 3 (FSL, MOST, ASI) + BRAR combined |
| Drawing tools | 32 | 15 | 17 custom overlays |
| Keyboard shortcuts | 14 | 0 (no built-in) | All custom |
| Crosshair sync | manual | Native | Zero code |
| Zoom sync | manual | Native | Zero code |
| Time axis sync | manual | Native | Zero code |

### 通达信 Reference (C:\new_tdx)
- .day format: 32 bytes/record (uint32 date, uint32 OHLC×4 in cents, float32 amount, uint32 volume)
- Watchlist in zxg.blk
- Indicator config in user.ini
- Drawing tool UX: right-click → 编辑画线/删除画线/锁定画线

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Single KLineChart instance | Replaces 3 LW Charts + 500 LOC manual sync |
| DataLoader API for lazy loading | KLineChart native; replaces manual scroll listener |
| `sv_` prefix for custom overlays | Namespace isolation from built-in overlays |
| Keep Zustand store interfaces | Minimize breaking changes in UI components |
| Web Worker removed | KLineChart calculates indicators internally |
| D3 kept for SectorHeatmap only | BacktestResult migrated to KLineChart |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Ralph first run produced empty iteration-1.json | Re-ran with new run ID; claude CLI was working but output redirect timing issue |
| `set -euo pipefail` in ralph.sh can silently exit | The `\|\| true` after claude command handles this |

## Resources
- KLineChart GitHub: https://github.com/liihuu/KLineChart
- KLineChart docs: https://klinecharts.com/
- Type defs: `node_modules/klinecharts/dist/index.d.ts`
- Design spec: `docs/superpowers/specs/2026-04-09-klinechart-migration-design.md`
- Plan: `docs/superpowers/plans/2026-04-09-klinechart-migration.md`
- PRD: `plans/prd.json`
