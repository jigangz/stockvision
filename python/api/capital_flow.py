"""
GET /api/capital_flow — Returns capital flow analysis for a stock.

Categories (by single-trade amount):
  large  (大单/主力): > 50万 (500,000 yuan)
  medium (中单):       5–50万 (50,000–500,000 yuan)
  small  (小单/散户): < 5万  (50,000 yuan)

Each category returns: buy_volume, sell_volume, net_volume,
                        buy_amount, sell_amount, net_amount.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/capital_flow", tags=["capital_flow"])

HISTORY_DAYS = 30  # trading days to return


def _split_buy_sell(total_amount: float, total_volume: float, net_bias: float) -> dict:
    """Split a total into buy / sell given a net bias in [-0.5, 0.5]."""
    buy_pct = max(0.05, min(0.95, 0.5 + net_bias))
    sell_pct = 1.0 - buy_pct
    return {
        "buy_amount": round(total_amount * buy_pct, 0),
        "sell_amount": round(total_amount * sell_pct, 0),
        "net_amount": round(total_amount * (buy_pct - sell_pct), 0),
        "buy_volume": round(total_volume * buy_pct, 0),
        "sell_volume": round(total_volume * sell_pct, 0),
        "net_volume": round(total_volume * (buy_pct - sell_pct), 0),
    }


def _flow_for_day(code: str, date_str: str, volume: float, amount: float) -> dict:
    """Simulate capital flow for a single trading day."""
    rng = random.Random(hash(f"{code}_flow_{date_str}"))

    # Distribute amount into three categories
    large_pct = rng.uniform(0.20, 0.45)
    medium_pct = rng.uniform(0.18, 0.32)
    small_pct = max(0.05, 1.0 - large_pct - medium_pct)

    # Normalise so they sum to 1
    total = large_pct + medium_pct + small_pct
    large_pct /= total
    medium_pct /= total
    small_pct /= total

    large_amount = amount * large_pct
    medium_amount = amount * medium_pct
    small_amount = amount * small_pct

    large_volume = volume * large_pct
    medium_volume = volume * medium_pct
    small_volume = volume * small_pct

    # Buy/sell biases: large tends to be decisive; small contrarian
    large_bias = rng.uniform(-0.25, 0.25)
    medium_bias = rng.uniform(-0.18, 0.18)
    small_bias = rng.uniform(-0.15, 0.15)

    return {
        "large": _split_buy_sell(large_amount, large_volume, large_bias),
        "medium": _split_buy_sell(medium_amount, medium_volume, medium_bias),
        "small": _split_buy_sell(small_amount, small_volume, small_bias),
    }


def _get_flow_data(code: str, market: str, period: str) -> dict:
    from data.mock_adapter import MockAdapter

    adapter = MockAdapter()
    today = datetime.now()
    # Fetch enough days to cover HISTORY_DAYS trading days
    start = (today - timedelta(days=HISTORY_DAYS * 2)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")

    candles = adapter.fetch_kline(code, market, period, start, end)
    # Keep only the last HISTORY_DAYS candles
    candles = candles[-HISTORY_DAYS:]

    history: list[dict] = []
    for c in candles:
        # date is 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM' — take first 10 chars
        date_str = c.date[:10]

        flow = _flow_for_day(code, date_str, float(c.volume), float(c.amount))
        history.append(
            {
                "date": date_str,
                "large": flow["large"],
                "medium": flow["medium"],
                "small": flow["small"],
            }
        )

    today_flow = history[-1] if history else None

    return {
        "code": code,
        "market": market,
        "period": period,
        "today": today_flow,
        "history": history,
    }


@router.get("")
def get_capital_flow(
    code: str = Query(..., description="Stock code"),
    market: str = Query(..., description="Market (SH/SZ)"),
    period: str = Query("daily", description="Period"),
) -> dict:
    """Return capital flow analysis for the given stock."""
    return _get_flow_data(code, market, period)
