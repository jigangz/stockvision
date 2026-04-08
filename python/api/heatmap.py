"""
GET /api/heatmap/sectors — Returns sector + stock data for the heatmap treemap.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])


def _get_sector_data() -> list[dict]:
    """Compute latest-day metrics for all mock stocks, grouped by sector."""
    from data.mock_adapter import MockAdapter

    adapter = MockAdapter()

    today = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

    sector_map: dict[str, list[dict]] = {}

    for stock in adapter.MOCK_STOCKS:
        code = stock["code"]
        market = stock["market"]
        sector = stock.get("sector", "其他")

        try:
            candles = adapter.fetch_kline(code, market, "daily", start, today)
            if len(candles) < 2:
                continue
            last = candles[-1]
            prev = candles[-2]

            change_pct = (last.close - prev.close) / prev.close * 100 if prev.close else 0.0

            # Simulate market_cap: shares outstanding approximated so that
            # each stock has a rough A-share-realistic market cap in 亿元.
            # We use base_price as proxy for the "par value" ratio.
            base_price = adapter.BASE_PRICES.get(code, 20.0)
            shares_outstanding = 5_000_000_000 / base_price  # normalize
            market_cap = last.close * shares_outstanding  # in yuan

            stock_data = {
                "code": code,
                "name": stock["name"],
                "market": market,
                "sector": sector,
                "close": round(last.close, 2),
                "change_pct": round(change_pct, 2),
                "volume": round(last.volume, 0),
                "amount": round(last.amount, 2),
                "market_cap": round(market_cap, 0),
            }

            sector_map.setdefault(sector, []).append(stock_data)
        except Exception:
            continue

    sectors: list[dict] = []
    for sector_name, stocks in sector_map.items():
        total_volume = sum(s["volume"] for s in stocks)
        total_market_cap = sum(s["market_cap"] for s in stocks)
        avg_change_pct = sum(s["change_pct"] for s in stocks) / len(stocks)

        sectors.append(
            {
                "name": sector_name,
                "change_pct": round(avg_change_pct, 2),
                "volume": total_volume,
                "market_cap": total_market_cap,
                "stock_count": len(stocks),
                "stocks": stocks,
            }
        )

    # Sort sectors by volume descending so layout is stable
    sectors.sort(key=lambda s: s["volume"], reverse=True)
    return sectors


@router.get("/sectors")
def get_sectors() -> dict:
    """Return sector heatmap data with nested stock details."""
    sectors = _get_sector_data()
    return {
        "sectors": sectors,
        "total_sectors": len(sectors),
        "total_stocks": sum(s["stock_count"] for s in sectors),
    }
