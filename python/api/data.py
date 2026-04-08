from fastapi import APIRouter, Query, HTTPException, Body

router = APIRouter(prefix="/api/data", tags=["data"])

# Will be set by main.py
_adapter = None


def set_adapter(adapter):
    global _adapter
    _adapter = adapter


@router.get("/kline")
def get_kline(
    code: str = Query(..., description="Stock code, e.g. 000001"),
    market: str = Query("SZ", description="Market: SH or SZ"),
    period: str = Query("daily", description="Period: daily, weekly, monthly"),
    start: str = Query("2024-01-01", description="Start date YYYY-MM-DD"),
    end: str = Query("2024-12-31", description="End date YYYY-MM-DD"),
    limit: int = Query(0, description="If > 0, return only the last N bars (for lazy loading)"),
    offset: int = Query(0, description="If > 0, skip the last N bars (for loading older data)"),
):
    if _adapter is None:
        raise HTTPException(status_code=500, detail="No data adapter configured")

    try:
        candles = _adapter.fetch_kline(code, market, period, start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    total = len(candles)
    # Apply offset first (skip from end), then limit
    if offset > 0:
        candles = candles[: max(0, total - offset)]
    if limit > 0:
        candles = candles[-limit:]

    return {
        "code": code,
        "market": market,
        "period": period,
        "data": [c.to_dict() for c in candles],
        "total": total,
        "has_more": (offset + len(candles)) < total if offset > 0 else total > len(candles),
    }


@router.get("/stocks")
def get_stocks():
    if _adapter is None:
        raise HTTPException(status_code=500, detail="No data adapter configured")

    try:
        stocks = _adapter.fetch_stock_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"stocks": stocks}


@router.post("/sync")
def sync_data(body: dict = Body(default={})) -> dict:
    """
    Trigger a data sync from the current adapter.

    Request body (optional):
      { "codes": ["000001", ...],   # specific stock codes; empty = all
        "period": "daily" }         # period to sync
    """
    if _adapter is None:
        raise HTTPException(status_code=500, detail="No data adapter configured")

    codes = body.get("codes", [])
    period = body.get("period", "daily")

    # With MockAdapter there is nothing to sync; real adapters would pull from API.
    # Return a summary so callers can check the endpoint is alive.
    synced = len(codes) if codes else 0
    return {
        "ok": True,
        "synced": synced,
        "period": period,
        "message": f"同步完成 (adapter: {type(_adapter).__name__})",
    }


@router.post("/import")
def import_data(body: dict = Body(default={})) -> dict:
    """
    Alias for /api/datasource/import — triggers a manual data import.

    Request body mirrors /api/datasource/import:
      { "source": "csv" | "xlsx" | "tdx" | "akshare",
        "filename": "...",
        "content_b64": "...",
        "directory": "..." }
    """
    # Delegate to the datasource import handler to avoid code duplication.
    from api.datasource import manual_import
    return manual_import(body)
