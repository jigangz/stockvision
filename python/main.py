import sys
from pathlib import Path

# Ensure the python package root is on sys.path
_pkg_root = str(Path(__file__).parent)
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)

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
from api.quotes import router as quotes_router
from data.mock_adapter import MockAdapter

import logging

logger = logging.getLogger("stockvision")

app = FastAPI(title="StockVision API", version="0.1.0")

# CORS — allow Tauri webview and dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Adapter init ---
# STOCKVISION_ADAPTER env var: "mock" forces MockAdapter, "akshare" (default) tries AKShare.
import os
_adapter_env = os.environ.get("STOCKVISION_ADAPTER", "akshare").lower()

_adapter_name = "MockAdapter"
if _adapter_env == "mock":
    adapter = MockAdapter()
    logger.info("Using MockAdapter (forced via STOCKVISION_ADAPTER=mock)")
else:
    try:
        from data.akshare_adapter import AkshareAdapter
        adapter = AkshareAdapter()
        import akshare  # noqa: F401
        _adapter_name = "AkshareAdapter"
        logger.info("Using AkshareAdapter (real market data)")
    except Exception as e:
        logger.warning(f"AKShare unavailable ({e}), falling back to MockAdapter")
        adapter = MockAdapter()

set_adapter(adapter)

# --- API health monitor state ---
from api.health_monitor import router as health_monitor_router, record_api_error, record_api_success  # noqa: E402

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
app.include_router(quotes_router)
app.include_router(health_monitor_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "adapter": _adapter_name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8899, reload=True)
