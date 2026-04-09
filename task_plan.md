# Task Plan: KLineChart Migration (v0.3.1 → v0.4.0)

## Goal
Replace Lightweight Charts 4.x with KLineChart 10.x as StockVision's sole charting engine, preserving all existing features while deleting ~2000 lines of manual chart sync code.

## Current Phase
Phase 3 (Ralph loop executing MIG-1 through MIG-GATE)

## Reference Files
- Design spec: `docs/superpowers/specs/2026-04-09-klinechart-migration-design.md`
- Detailed plan: `docs/superpowers/plans/2026-04-09-klinechart-migration.md`
- PRD (Ralph reads): `plans/prd.json` (17 tasks: MIG-1 ~ MIG-GATE)
- Old PRD backup: `plans/prd-v031.json.bak`
- Ralph runs: `scripts/ralph/runs/`

## Phases

### Phase 1: Research & Design
- [x] Audit existing features (32 drawing tools, 22 indicators, 14 shortcuts, 10 dialogs)
- [x] Audit KLineChart v10 capabilities (15 overlays, 26 indicators, API surface)
- [x] Double audit against conversation history (user requirement)
- [x] Present comparison table to user
- [x] User approved migration
- **Status:** complete

### Phase 2: Planning
- [x] Write design spec → `docs/superpowers/specs/2026-04-09-klinechart-migration-design.md`
- [x] Write implementation plan (17 tasks) → `docs/superpowers/plans/2026-04-09-klinechart-migration.md`
- [x] Self-review plan against spec
- [x] Create migration PRD → `plans/prd.json`
- [x] Set up progress.md for Ralph context
- **Status:** complete

### Phase 3: Execution (Ralph Loop)
- [x] MIG-1: Data adapter + KLineChart dark theme
- [x] MIG-10: DrawingCanvas → DrawingBridge
- [x] MIG-11: BacktestResult equity curve migration
- [ ] MIG-2: KLineChartWrapper core component
- [ ] MIG-3: Overlay mapping + custom overlays
- [ ] MIG-4: Custom indicators (FSL, MOST, ASI, BRAR)
- [ ] MIG-5: ChartContainer rewrite
- [ ] MIG-6: useKeyboardShortcuts adaptation
- [ ] MIG-7: Register custom code at entry
- [ ] MIG-8: Simplify crosshairStore
- [ ] MIG-9: Delete old LW Charts files
- [ ] MIG-12: Delete IndicatorChart + move FormulaSeries
- [ ] MIG-13: DrawingContextMenu update
- [ ] MIG-14: Remove lightweight-charts dep
- [ ] MIG-15: Version bump to 0.4.0
- [ ] MIG-16: DataLoader integration
- [ ] MIG-GATE: Final verification
- **Status:** in_progress
- **Execution method:** Ralph Bash (`bash scripts/ralph/ralph.sh --max-iterations 25`)
- **Run ID:** 20260409-022556

### Phase 4: Verification & Smoke Test
- [ ] npm run typecheck passes
- [ ] No lightweight-charts references in src/
- [ ] Visual smoke test (dev server)
- [ ] All existing features preserved
- **Status:** pending

### Phase 5: Delivery
- [ ] Push to GitHub
- [ ] User testing
- [ ] Fix feedback issues
- **Status:** pending

## Key Decisions
| Decision | Rationale |
|----------|-----------|
| KLineChart 10.0.0-beta1 over alternatives | Native multi-pane, 26 indicators, 15+ overlays, Chinese locale |
| Single chart instance (not 3 separate) | Eliminates ~500 LOC of manual crosshair/zoom/time sync |
| Keep drawingStore interface unchanged | Minimizes impact on DrawingToolbar, DrawingContextMenu |
| Ralph Bash over Agent Dispatch | User preference; higher automation, self-verification |
| Custom overlays with `sv_` prefix | Avoid name collisions with KLineChart built-in overlays |
| 4 custom indicators (FSL/MOST/ASI/BRAR) | Not in KLineChart built-in; JS calc functions needed |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Ralph iteration-1.json empty (0 bytes) | 1 | First run had silent failure; re-ran with new run ID, worked fine |

## Notes
- User preference: Ralph Bash is the default execution method for all future big projects
- SIGN-034: Never mix Ralph bash + Agent tool dispatch simultaneously
- KLineChart v10 is beta — pin exact version, test thoroughly
- Python backend: zero changes needed
