import random
import math
from datetime import datetime, timedelta
from data.adapter import DataAdapter
from models.candle import Candle


class MockAdapter(DataAdapter):
    """Generate realistic random OHLCV data with trending behavior."""

    MOCK_STOCKS = [
        {"code": "000001", "name": "平安银行", "market": "SZ", "sector": "银行", "list_date": "1991-04-03"},
        {"code": "600519", "name": "贵州茅台", "market": "SH", "sector": "白酒", "list_date": "2001-08-27"},
        {"code": "000858", "name": "五粮液", "market": "SZ", "sector": "白酒", "list_date": "1998-04-27"},
        {"code": "601318", "name": "中国平安", "market": "SH", "sector": "保险", "list_date": "2007-03-01"},
        {"code": "000002", "name": "万科A", "market": "SZ", "sector": "房地产", "list_date": "1991-01-29"},
        {"code": "600036", "name": "招商银行", "market": "SH", "sector": "银行", "list_date": "2002-04-09"},
        {"code": "002594", "name": "比亚迪", "market": "SZ", "sector": "汽车", "list_date": "2011-06-30"},
        {"code": "601012", "name": "隆基绿能", "market": "SH", "sector": "光伏", "list_date": "2012-04-11"},
    ]

    # Base prices for each stock (roughly realistic)
    BASE_PRICES = {
        "000001": 12.0,
        "600519": 1800.0,
        "000858": 160.0,
        "601318": 50.0,
        "000002": 10.0,
        "600036": 35.0,
        "002594": 250.0,
        "601012": 25.0,
    }

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        seed = hash(f"{code}_{market}_{period}_{start}")
        rng = random.Random(seed)

        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")

        base_price = self.BASE_PRICES.get(code, 20.0)
        price = base_price

        # Generate trend parameters
        trend_strength = rng.uniform(-0.0005, 0.0008)  # slight upward bias
        volatility = rng.uniform(0.015, 0.035)

        candles: list[Candle] = []
        current = start_date

        while current <= end_date:
            # Skip weekends
            if current.weekday() >= 5:
                current += timedelta(days=1)
                continue

            # Trend + random walk
            drift = trend_strength + rng.gauss(0, volatility)
            # Occasional regime changes
            if rng.random() < 0.02:
                trend_strength = rng.uniform(-0.001, 0.001)

            price *= (1 + drift)
            price = max(price * 0.1, price)  # prevent going to zero

            # Generate OHLCV from close price
            daily_range = price * rng.uniform(0.005, 0.03)
            open_price = price + rng.uniform(-daily_range * 0.5, daily_range * 0.5)
            high_price = max(open_price, price) + rng.uniform(0, daily_range * 0.5)
            low_price = min(open_price, price) - rng.uniform(0, daily_range * 0.5)
            close_price = price

            # Volume with some variation
            base_vol = base_price * 1_000_000 / price  # normalize volume
            volume = base_vol * rng.uniform(0.5, 2.5)
            # Higher volume on big moves
            if abs(drift) > volatility:
                volume *= rng.uniform(1.5, 3.0)

            amount = volume * (open_price + close_price) / 2

            candles.append(Candle(
                date=current.strftime("%Y-%m-%d"),
                open=round(open_price, 2),
                high=round(high_price, 2),
                low=round(low_price, 2),
                close=round(close_price, 2),
                volume=round(volume, 0),
                amount=round(amount, 2),
            ))

            current += timedelta(days=1)

        return candles

    def fetch_stock_list(self) -> list[dict]:
        return [s.copy() for s in self.MOCK_STOCKS]
