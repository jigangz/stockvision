"""
Tests for POST /api/stats/interval endpoint.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def make_candles(n: int = 30) -> list[dict]:
    """Generate simple deterministic candle data."""
    candles = []
    price = 100.0
    for i in range(n):
        month = (i // 28) % 12 + 1
        day = (i % 28) + 1
        date = f"2024-{month:02d}-{day:02d}"
        close = round(price + i * 0.5, 2)
        high = round(close + 1.0, 2)
        low = round(close - 1.0, 2)
        open_ = round(close - 0.2, 2)
        volume = 1_000_000.0
        amount = volume * close
        candles.append({
            "date": date,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
            "amount": amount,
        })
    return candles


CANDLES = make_candles(30)


def test_interval_stats_basic_structure():
    """Response has correct top-level keys."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    assert resp.status_code == 200
    data = resp.json()
    assert "period" in data
    assert "left" in data
    assert "right" in data


def test_interval_stats_period_fields():
    """period block contains start_date, end_date, trading_days."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    period = resp.json()["period"]
    assert "start_date" in period
    assert "end_date" in period
    assert "trading_days" in period
    assert period["trading_days"] == len(CANDLES)


def test_interval_stats_left_fields():
    """left block contains all required price fields."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    left = resp.json()["left"]
    required = [
        "period_return", "period_high", "period_high_date",
        "period_low", "period_low_date", "period_open",
        "period_close", "period_amplitude", "period_avg_price",
    ]
    for field in required:
        assert field in left, f"Missing field: {field}"


def test_interval_stats_right_fields():
    """right block contains all required capital flow and volatility fields."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    right = resp.json()["right"]
    required = [
        "total_volume", "total_amount", "avg_daily_volume", "avg_daily_amount",
        "return_std", "max_daily_return", "max_daily_loss", "annualized_volatility",
    ]
    for field in required:
        assert field in right, f"Missing field: {field}"


def test_interval_stats_correct_high_low():
    """period_high and period_low match expected values."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    left = resp.json()["left"]
    expected_high = max(c["high"] for c in CANDLES)
    expected_low = min(c["low"] for c in CANDLES)
    assert left["period_high"] == pytest.approx(expected_high, abs=0.01)
    assert left["period_low"] == pytest.approx(expected_low, abs=0.01)


def test_interval_stats_correct_return():
    """period_return is (close[-1] - open[0]) / open[0] * 100."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    left = resp.json()["left"]
    expected = (CANDLES[-1]["close"] - CANDLES[0]["open"]) / CANDLES[0]["open"] * 100
    assert left["period_return"] == pytest.approx(expected, abs=0.01)


def test_interval_stats_date_filter():
    """start_date and end_date filters work correctly."""
    resp = client.post("/api/stats/interval", json={
        "data": CANDLES,
        "start_date": CANDLES[5]["date"],
        "end_date": CANDLES[14]["date"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"]["trading_days"] == 10
    assert data["period"]["start_date"] == CANDLES[5]["date"]
    assert data["period"]["end_date"] == CANDLES[14]["date"]


def test_interval_stats_total_volume():
    """total_volume equals sum of all volumes."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    right = resp.json()["right"]
    expected_vol = sum(c["volume"] for c in CANDLES)
    assert right["total_volume"] == pytest.approx(expected_vol, rel=0.001)


def test_interval_stats_total_amount():
    """total_amount equals sum of all amounts."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES})
    right = resp.json()["right"]
    expected_amt = sum(c["amount"] for c in CANDLES)
    assert right["total_amount"] == pytest.approx(expected_amt, rel=0.001)


def test_interval_stats_accepts_time_key():
    """Accepts 'time' key instead of 'date'."""
    candles_time = [
        {**c, "time": c["date"]} for c in CANDLES[:5]
    ]
    # remove 'date' key
    for c in candles_time:
        del c["date"]
    resp = client.post("/api/stats/interval", json={"data": candles_time})
    assert resp.status_code == 200


def test_interval_stats_empty_data():
    """Empty data returns 400."""
    resp = client.post("/api/stats/interval", json={"data": []})
    assert resp.status_code == 400


def test_interval_stats_out_of_range_filter():
    """Date filter that excludes all data returns 400."""
    resp = client.post("/api/stats/interval", json={
        "data": CANDLES,
        "start_date": "2030-01-01",
        "end_date": "2030-12-31",
    })
    assert resp.status_code == 400


def test_interval_stats_single_candle():
    """Single candle works (no daily returns to compute)."""
    resp = client.post("/api/stats/interval", json={"data": CANDLES[:1]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"]["trading_days"] == 1
    assert data["right"]["return_std"] == 0.0
    assert data["right"]["annualized_volatility"] == 0.0
