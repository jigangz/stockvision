from fastapi import APIRouter, Query, HTTPException

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
