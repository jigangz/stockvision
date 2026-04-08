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
):
    if _adapter is None:
        raise HTTPException(status_code=500, detail="No data adapter configured")

    try:
        candles = _adapter.fetch_kline(code, market, period, start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"code": code, "market": market, "period": period, "data": [c.to_dict() for c in candles]}


@router.get("/stocks")
def get_stocks():
    if _adapter is None:
        raise HTTPException(status_code=500, detail="No data adapter configured")

    try:
        stocks = _adapter.fetch_stock_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"stocks": stocks}
