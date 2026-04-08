"""
POST /api/backtest/run — run a formula-based backtest.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    code: str = "000001"
    market: str = "SZ"
    period: str = "daily"
    start: str | None = None
    end: str | None = None
    buy_formula: str
    sell_formula: str
    initial_capital: float = 100_000.0
    commission_rate: float = 0.0


@router.post("/run")
def run_backtest(req: BacktestRequest) -> dict[str, Any]:
    """
    Run a backtest using formula-based buy/sell signals on historical data.

    Returns performance metrics and trade records.
    """
    from data.mock_adapter import MockAdapter
    from data.backtest_engine import BacktestEngine

    # Date range defaults
    end_date = req.end or datetime.now().strftime("%Y-%m-%d")
    start_date = req.start or (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    # Validate formulas are not empty
    if not req.buy_formula.strip():
        raise HTTPException(status_code=400, detail="buy_formula is required")
    if not req.sell_formula.strip():
        raise HTTPException(status_code=400, detail="sell_formula is required")

    # Fetch candle data
    adapter = MockAdapter()
    try:
        candles = adapter.fetch_kline(req.code, req.market, req.period, start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {e}")

    if len(candles) < 2:
        raise HTTPException(status_code=400, detail="Not enough data to run backtest")

    candle_dicts = [c.to_dict() for c in candles]

    # Run backtest
    try:
        engine = BacktestEngine(
            candles=candle_dicts,
            buy_formula=req.buy_formula,
            sell_formula=req.sell_formula,
            initial_capital=req.initial_capital,
            commission_rate=req.commission_rate,
        )
        result = engine.run()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Backtest error: {e}")

    return {
        "code": req.code,
        "market": req.market,
        "period": req.period,
        "start": start_date,
        "end": end_date,
        "barCount": len(candle_dicts),
        **result,
    }
