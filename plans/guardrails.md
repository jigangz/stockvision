# Ralph Guardrails (Signs) — StockVision

Learned constraints that prevent repeated failures. Each "sign" is a rule discovered through iteration.

> "Progress should persist. Failures should evaporate." - The Ralph philosophy

---

## Verification Signs

### SIGN-001: Verify Before Complete
**Trigger:** About to output completion promise
**Instruction:** ALWAYS run the verification command and confirm it passes before outputting `<promise>COMPLETE</promise>`
**Reason:** Models tend to declare victory without proper verification

### SIGN-002: Check All Tasks Before Complete
**Trigger:** Completing a task in multi-task mode
**Instruction:** Re-read prd.json and count remaining `passes: false` tasks. Only output completion promise when ALL tasks pass, not just the current one.
**Reason:** Premature completion exits loop with work remaining

---

## Progress Signs

### SIGN-003: Document Learnings
**Trigger:** Completing any task
**Instruction:** Update progress.md with what was learned (patterns discovered, files modified, decisions made) before ending iteration
**Reason:** Future iterations need context to avoid re-discovering the same patterns

### SIGN-004: Small Focused Changes
**Trigger:** Making changes per iteration
**Instruction:** Keep changes small and focused. Commit incrementally when tests pass. Don't try to solve everything in one iteration.
**Reason:** Large changes are harder to debug when verification fails

---

## Phase Gate Signs

### SIGN-010: Phase Gate Is Mandatory
**Trigger:** Completing the last task in a phase (before the GATE task)
**Instruction:** Do NOT mark the GATE task as passed until ALL acceptance criteria for that phase are verified. Run the full test suite for that phase. If any criterion fails, fix it before marking the gate as passed.
**Reason:** 每个阶段完成后必须跑完整测试，全部通过才能进入下一个阶段。不能跳过 phase gate。

### SIGN-011: Phase Gate Tests Must Be Comprehensive
**Trigger:** Running phase gate verification
**Instruction:** Phase gate tests must cover: (1) all features in that phase work end-to-end, (2) no TypeScript compile errors, (3) no Python test failures, (4) UI matches reference screenshots / design spec. Don't just check that code compiles — verify it actually works.
**Reason:** Superficial tests miss integration issues that compound in later phases

### SIGN-012: Never Skip to Next Phase
**Trigger:** Phase gate test fails
**Instruction:** Fix all failing tests in current phase before starting any task in the next phase. Do NOT work on Phase N+1 tasks while Phase N gate is failing.
**Reason:** Building on broken foundations causes cascading failures

---

## StockVision-Specific Signs

### SIGN-020: CSS Variables Only
**Trigger:** Writing any color value in React components
**Instruction:** All colors MUST use CSS variables (--color-*, --bg-*, --ma*, etc.). Never hardcode hex colors in component files. Define new colors in theme files only.
**Reason:** Theme consistency — 通达信 style black background with red/green scheme must be globally controllable

### SIGN-021: Data Adapter Abstraction
**Trigger:** Adding data fetching code
**Instruction:** All data access must go through the DataAdapter interface. Frontend never calls AKShare/Tushare/TDX directly. New data sources implement the same interface.
**Reason:** 用户需要同时支持 API 和通达信本地数据，抽象层保证可切换

### SIGN-022: Price-Time Coordinates for Drawings
**Trigger:** Implementing drawing tools
**Instruction:** Store all drawing points as {time: unix_timestamp, price: number}. Never store pixel coordinates. Convert to pixels only at render time using chart.timeScale().timeToCoordinate() and series.priceToCoordinate().
**Reason:** Pixel coordinates break on zoom/scroll/resize. Price-time coordinates are stable.

### SIGN-023: EXE Distribution Compatibility
**Trigger:** Adding new dependencies or native modules
**Instruction:** Every dependency must work when bundled via PyInstaller (Python) or Tauri (frontend). Test that new deps don't break the build. Avoid dependencies that require system-level installs.
**Reason:** 最终用户是老人，只会双击安装 EXE，不会装 Python/Node/Docker

### SIGN-024: 通达信 UI Reference
**Trigger:** Implementing any UI component
**Instruction:** Check the design spec and reference screenshots before implementing UI. Layout proportions, colors, and data fields must match the spec. When in doubt, follow 通达信 conventions.
**Reason:** The app is 仿通达信 style — consistency with the reference is a requirement, not a nice-to-have

---

## Task Management Signs

### SIGN-005: Use Skip for Manual Tasks
**Trigger:** Encountering a task that requires manual human intervention
**Instruction:** Set `skip: true` and `skipReason` in prd.json for tasks that cannot be automated.
**Reason:** Allows loop to complete automatable work without blocking on manual steps

### SIGN-006: Reference GitHub Issues in Commits
**Trigger:** Committing changes for a prd.json task
**Instruction:** Include `Fixes #N` or `Closes #N` in commit message body (where N is the `github_issue` from prd.json).
**Reason:** Auto-closes GitHub issues when merged to main

---

## Project-Specific Signs

Add signs below as you encounter project-specific failure patterns:

### SIGN-030: Virtual Scroll — No External Dependencies
**Trigger:** Implementing market table with 5000+ rows
**Instruction:** Use manual virtual scrolling (calculate visible rows from scroll position + row height, position with absolute/transform). Do NOT add react-virtual, react-window, or any external virtual scroll library.
**Reason:** Minimal dependencies policy. The math is simple: visibleStart = floor(scrollTop / rowHeight), render only visible rows.
**Added after:** v0.3 planning, 2026-04-08

### SIGN-031: Quotes Cache — Backend Not Frontend
**Trigger:** Fetching real-time quotes
**Instruction:** Cache quotes on the backend (30s TTL in-memory). Frontend polls backend every 30s. Don't cache in localStorage or duplicate caching logic.
**Reason:** Single source of truth. AKShare rate limits are enforced server-side.
**Added after:** v0.3 planning, 2026-04-08

### SIGN-032: Keyboard Events — Check Focus Target
**Trigger:** Adding global keyboard listeners (keyboard wizard, arrow navigation)
**Instruction:** Always check `document.activeElement` before handling keydown. Skip if an input/textarea/select is focused, or if a dialog is open (anyDialogOpen flag).
**Reason:** Keyboard wizard should not trigger while user is typing in a text field or dialog.
**Added after:** v0.3 planning, 2026-04-08

### SIGN-033: Flex Layout — Account for Fixed Elements
**Trigger:** Adding sidebar or panels to existing flex layout
**Instruction:** When adding fixed-width sidebars (watchlist 160px, info panel 200px), the chart area must use flex:1 to fill remaining space. Don't use percentage widths that don't account for sidebars.
**Reason:** Previous bug: 55%+20%+25% flex-basis + 24px toolbar = overflow. Use flex-grow ratios, not percentages.
**Added after:** v0.3 planning, 2026-04-08
