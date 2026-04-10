"""
Entry point for the PyInstaller-bundled sidecar executable.
Used when running as a Tauri sidecar binary (no reload mode).
"""
import sys
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stockvision")

# Ensure the package root is on sys.path (needed for PyInstaller one-file mode)
_pkg_root = str(Path(__file__).parent)
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)

# PyInstaller: the temp folder is sys._MEIPASS
if hasattr(sys, "_MEIPASS"):
    _meipass = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    if str(_meipass) not in sys.path:
        sys.path.insert(0, str(_meipass))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.data import router as data_router, set_adapter
from api.config import router as config_router
from api.drawings import router as drawings_router
from api.indicators import router as indicators_router
from api.stats import router as stats_router
from api.formula import router as formula_router
from api.screener import router as screener_router
from api.heatmap import router as heatmap_router
from api.capital_flow import router as capital_flow_router
from api.datasource import router as datasource_router
from api.backtest import router as backtest_router
from api.health_monitor import router as health_monitor_router
from api.quotes import router as quotes_router
from api.scheduler import router as scheduler_router, init_scheduler
from data.mock_adapter import MockAdapter

app = FastAPI(title="StockVision API", version="0.5.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Adapter init: use saved config, fallback to AKShare then Mock ---
_adapter_env = os.environ.get("STOCKVISION_ADAPTER", "").lower()

if _adapter_env == "mock":
    set_adapter(MockAdapter())
    logger.info("Using MockAdapter (forced via STOCKVISION_ADAPTER=mock)")
else:
    # Try to load saved datasource config and init adapter by priority
    _initialized = False
    try:
        from data import storage as _init_storage
        _init_storage.init_config_table()
        import json as _json
        _raw_cfg = _init_storage.load_config("datasource_config")
        if _raw_cfg:
            _cfg = _json.loads(_raw_cfg)
            _sources = _cfg.get("sources", [])
            from api.datasource import _switch_adapter
            _switch_adapter(_sources)
            _initialized = True
            logger.info("Adapter initialized from saved config")
    except Exception as e:
        logger.warning(f"Failed to load saved config: {e}")

    if not _initialized:
        # Default: try AKShare (verify the package is actually importable)
        try:
            import akshare  # noqa: F401
            from data.akshare_adapter import AkshareAdapter
            set_adapter(AkshareAdapter())
            logger.info("Using AkshareAdapter (default)")
        except Exception as e:
            logger.warning(f"AKShare unavailable ({e}), falling back to MockAdapter")
            set_adapter(MockAdapter())

app.include_router(data_router)
app.include_router(config_router)
app.include_router(drawings_router)
app.include_router(indicators_router)
app.include_router(stats_router)
app.include_router(formula_router)
app.include_router(screener_router)
app.include_router(heatmap_router)
app.include_router(capital_flow_router)
app.include_router(datasource_router)
app.include_router(backtest_router)
app.include_router(health_monitor_router)
app.include_router(quotes_router)
app.include_router(scheduler_router)


@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup."""
    init_scheduler()


@app.get("/api/health")
def health():
    from api.data import _adapter
    name = type(_adapter).__name__ if _adapter else "None"
    return {"status": "ok", "adapter": name}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("STOCKVISION_PORT", "8899"))
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
