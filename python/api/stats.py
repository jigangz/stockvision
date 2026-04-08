"""
POST /api/stats/interval — compute interval statistics from raw candle data.
"""
from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/stats", tags=["stats"])


class StatsRequest(BaseModel):
    data: list[dict[str, Any]]
    start_date: str | None = None
    end_date: str | None = None


def _safe_round(v: float, n: int = 2) -> float:
    if math.isnan(v) or math.isinf(v):
        return 0.0
    return round(v, n)


@router.post("/interval")
def interval_stats(req: StatsRequest) -> dict:
    """
    Compute interval statistics for a range of candle data.

    Request body:
    - data: list of candle dicts {date/time, open, high, low, close, volume, amount?}
    - start_date: optional YYYY-MM-DD filter (inclusive)
    - end_date: optional YYYY-MM-DD filter (inclusive)

    Returns two-column stats matching 通达信 interval stats dialog.
    """
    if not req.data:
        raise HTTPException(status_code=400, detail="data cannot be empty")

    # Normalize candle dicts — accept 'time' or 'date' key
    candles = []
    for c in req.data:
        date_val = c.get("date") or c.get("time") or ""
        # Extract date part only (YYYY-MM-DD) for filtering
        date_str = str(date_val)[:10]
        candles.append({
            "date": date_str,
            "open": float(c.get("open", 0)),
            "high": float(c.get("high", 0)),
            "low": float(c.get("low", 0)),
            "close": float(c.get("close", 0)),
            "volume": float(c.get("volume", 0)),
            "amount": float(c.get("amount", 0)),
        })

    # Filter by date range if specified
    if req.start_date:
        candles = [c for c in candles if c["date"] >= req.start_date]
    if req.end_date:
        candles = [c for c in candles if c["date"] <= req.end_date]

    if not candles:
        raise HTTPException(status_code=400, detail="No candles in specified date range")

    trading_days = len(candles)

    # Basic price stats
    period_open = candles[0]["open"]
    period_close = candles[-1]["close"]

    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    period_high = max(highs)
    period_low = min(lows)

    period_high_date = candles[highs.index(period_high)]["date"]
    period_low_date = candles[lows.index(period_low)]["date"]

    # Period return: (close - open) / open * 100
    period_return = (period_close - period_open) / period_open * 100 if period_open else 0.0

    # Amplitude: (high - low) / first_open * 100
    period_amplitude = (period_high - period_low) / period_open * 100 if period_open else 0.0

    # Average price: sum(amount) / sum(volume), fallback to avg close
    total_volume = sum(c["volume"] for c in candles)
    total_amount = sum(c["amount"] for c in candles)
    if total_volume > 0 and total_amount > 0:
        period_avg_price = total_amount / total_volume
    else:
        period_avg_price = sum(c["close"] for c in candles) / trading_days

    # Daily returns for volatility
    closes = [c["close"] for c in candles]
    daily_returns: list[float] = []
    for i in range(1, len(closes)):
        if closes[i - 1] > 0:
            daily_returns.append((closes[i] - closes[i - 1]) / closes[i - 1] * 100)

    if daily_returns:
        avg_ret = sum(daily_returns) / len(daily_returns)
        variance = sum((r - avg_ret) ** 2 for r in daily_returns) / len(daily_returns)
        return_std = math.sqrt(variance)
        max_daily_return = max(daily_returns)
        max_daily_loss = min(daily_returns)
        annualized_volatility = return_std * math.sqrt(252)
    else:
        return_std = 0.0
        max_daily_return = 0.0
        max_daily_loss = 0.0
        annualized_volatility = 0.0

    avg_daily_volume = total_volume / trading_days
    avg_daily_amount = total_amount / trading_days

    return {
        "period": {
            "start_date": candles[0]["date"],
            "end_date": candles[-1]["date"],
            "trading_days": trading_days,
        },
        "left": {
            "period_return": _safe_round(period_return, 2),
            "period_high": _safe_round(period_high, 2),
            "period_high_date": period_high_date,
            "period_low": _safe_round(period_low, 2),
            "period_low_date": period_low_date,
            "period_open": _safe_round(period_open, 2),
            "period_close": _safe_round(period_close, 2),
            "period_amplitude": _safe_round(period_amplitude, 2),
            "period_avg_price": _safe_round(period_avg_price, 2),
        },
        "right": {
            "total_volume": _safe_round(total_volume, 0),
            "total_amount": _safe_round(total_amount, 2),
            "avg_daily_volume": _safe_round(avg_daily_volume, 0),
            "avg_daily_amount": _safe_round(avg_daily_amount, 2),
            "return_std": _safe_round(return_std, 4),
            "max_daily_return": _safe_round(max_daily_return, 2),
            "max_daily_loss": _safe_round(max_daily_loss, 2),
            "annualized_volatility": _safe_round(annualized_volatility, 2),
        },
    }
