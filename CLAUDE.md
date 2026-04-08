# StockVision

仿通达信风格的股票盘后分析桌面应用。独立项目。

## Tech Stack

- **Desktop Shell**: Tauri 2.x (Rust)
- **Frontend**: React 18 + TypeScript (strict) + Vite
- **Charts**: Lightweight Charts 4.x (K-line, volume) + D3.js (heatmap) + ECharts (custom)
- **State**: Zustand 5
- **Backend**: FastAPI (Python sidecar, port 8899)
- **Indicators**: pandas-ta (22 indicators)
- **Formula**: lark parser (通达信 formula syntax)
- **Storage**: SQLite (metadata) + Parquet (OHLCV market data)
- **Data Sources**: AKShare API, Tushare API, 通达信 local files (.day/.5/.1)

## Project Structure

```
stockvision/
├── src/                    # React frontend
│   ├── components/
│   │   ├── chart/          # KLineChart, VolumeChart, IndicatorChart, ChartContainer
│   │   └── layout/         # MainLayout, TopNav, StatusBar
│   ├── hooks/              # useChartSync
│   ├── stores/             # Zustand stores (chartStore, dataStore)
│   ├── theme/              # global.css (CSS vars), darkTheme.ts
│   └── utils/              # periodAggregator
├── src-tauri/              # Tauri Rust shell
├── python/                 # FastAPI backend
│   ├── api/                # Route handlers
│   ├── data/               # DataAdapter implementations
│   └── models/             # Data models
├── tests/                  # Test suites
├── plans/                  # prd.json, guardrails.md, progress.md
└── scripts/ralph/          # Ralph loop automation
```

## Theme Constants

All colors defined as CSS variables in `src/theme/global.css`:

| Variable | Value | Usage |
|----------|-------|-------|
| --bg-primary | #000000 | Main background |
| --bg-secondary | #1A1A2E | Panel backgrounds |
| --bg-panel | #0D0D1A | Side panels |
| --color-up | #FF4444 | Price up (red, Chinese convention) |
| --color-down | #00CC66 | Price down (green) |
| --color-flat | #CCCCCC | Flat price |
| --ma5 | #FFFF00 | MA5 line (yellow) |
| --ma10 | #FF00FF | MA10 line (purple) |
| --ma20 | #00FF00 | MA20 line (green) |
| --ma60 | #FFFFFF | MA60 line (white) |
| --text-primary | #FFFFFF | Primary text |
| --text-secondary | #CCCCCC | Secondary text |
| --text-muted | #888888 | Muted text |
| --grid-line | #333333 | Chart grid |
| --border | #2A2A3E | Border color |

## Coding Conventions

- TypeScript strict mode, all types explicit
- Functional components, no class components
- Path alias: `@/` → `src/`
- File naming: kebab-case for files, PascalCase for components
- State management: Zustand only (no Redux, no Context for global state)
- CSS: CSS Modules or inline styles, CSS variables for all colors
- Python: type hints, FastAPI async handlers
- Commit messages: English, conventional commits format

## API Endpoints (localhost:8899)

- `GET /api/data/kline?code=&market=&period=&start=&end=` — K-line data
- `GET /api/data/stocks` — Stock list
- `POST /api/data/sync` — Sync data from adapter
- `POST /api/data/import` — Import local 通达信 files

## Development

```bash
# Frontend
npm run dev          # Vite dev server on :1420
npm run typecheck    # TypeScript check
npm run build        # Production build

# Backend
cd python && python main.py   # FastAPI on :8899

# Tauri
npm run tauri dev    # Desktop app (dev mode)
npm run tauri build  # Build installer (EXE/MSI)

# Tests
cd python && pytest ../tests/python/ -v
```

## Phase Gate Rules

Each phase must pass its gate test before proceeding to the next phase.
Verify command: `npm run typecheck && cd python && pytest ../tests/python/ -v && cd ..`
