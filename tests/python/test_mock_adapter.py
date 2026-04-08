import sys
from pathlib import Path

# Add python package root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from data.mock_adapter import MockAdapter


def test_fetch_kline_returns_candles():
    adapter = MockAdapter()
    candles = adapter.fetch_kline("000001", "SZ", "daily", "2024-01-01", "2024-12-31")
    assert len(candles) > 200, f"Expected ~250 trading days, got {len(candles)}"
    assert len(candles) < 265


def test_candle_ohlcv_relationships():
    adapter = MockAdapter()
    candles = adapter.fetch_kline("600519", "SH", "daily", "2024-01-01", "2024-12-31")

    for c in candles:
        assert c.high >= c.low, f"high ({c.high}) < low ({c.low}) on {c.date}"
        assert c.high >= c.open, f"high ({c.high}) < open ({c.open}) on {c.date}"
        assert c.high >= c.close, f"high ({c.high}) < close ({c.close}) on {c.date}"
        assert c.low <= c.open, f"low ({c.low}) > open ({c.open}) on {c.date}"
        assert c.low <= c.close, f"low ({c.low}) > close ({c.close}) on {c.date}"
        assert c.volume > 0, f"volume should be positive on {c.date}"
        assert c.amount > 0, f"amount should be positive on {c.date}"


def test_candle_prices_positive():
    adapter = MockAdapter()
    candles = adapter.fetch_kline("000858", "SZ", "daily", "2024-06-01", "2024-12-31")

    for c in candles:
        assert c.open > 0
        assert c.high > 0
        assert c.low > 0
        assert c.close > 0


def test_candle_dates_are_weekdays():
    from datetime import datetime
    adapter = MockAdapter()
    candles = adapter.fetch_kline("000001", "SZ", "daily", "2024-01-01", "2024-03-31")

    for c in candles:
        dt = datetime.strptime(c.date, "%Y-%m-%d")
        assert dt.weekday() < 5, f"{c.date} is a weekend"


def test_candle_to_dict():
    adapter = MockAdapter()
    candles = adapter.fetch_kline("000001", "SZ", "daily", "2024-01-01", "2024-01-10")
    assert len(candles) > 0

    d = candles[0].to_dict()
    assert "date" in d
    assert "open" in d
    assert "high" in d
    assert "low" in d
    assert "close" in d
    assert "volume" in d
    assert "amount" in d


def test_deterministic_output():
    adapter = MockAdapter()
    c1 = adapter.fetch_kline("000001", "SZ", "daily", "2024-01-01", "2024-01-31")
    c2 = adapter.fetch_kline("000001", "SZ", "daily", "2024-01-01", "2024-01-31")
    assert len(c1) == len(c2)
    for a, b in zip(c1, c2):
        assert a.close == b.close


def test_fetch_stock_list():
    adapter = MockAdapter()
    stocks = adapter.fetch_stock_list()
    assert len(stocks) >= 5
    for s in stocks:
        assert "code" in s
        assert "name" in s
        assert "market" in s
