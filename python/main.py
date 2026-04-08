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
from data.mock_adapter import MockAdapter

app = FastAPI(title="StockVision API", version="0.1.0")

# CORS — allow Tauri webview and dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default to MockAdapter
adapter = MockAdapter()
set_adapter(adapter)

app.include_router(data_router)
app.include_router(config_router)
app.include_router(drawings_router)
app.include_router(indicators_router)
app.include_router(stats_router)
app.include_router(formula_router)
app.include_router(screener_router)
app.include_router(heatmap_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "adapter": type(adapter).__name__}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8899, reload=True)
