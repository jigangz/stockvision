"""
Tests for POST /api/indicators/calculate endpoint.
Verifies all 22 indicators return correct structure and non-empty data.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Generate 100 mock candle data points
import math


def make_candles(n: int = 100) -> list[dict]:
    candles = []
    price = 10.0
    vol = 1_000_000.0
    for i in range(n):
        t = 1_700_000_000 + i * 86400  # daily timestamps
        date = f"2023-{(i // 30) + 1:02d}-{(i % 30) + 1:02d}".replace("-0-", "-01-")
        # Keep date in valid range
        day = (i % 28) + 1
        month = (i // 28) % 12 + 1
        date = f"2023-{month:02d}-{day:02d}"
        noise = math.sin(i * 0.3) * 0.5
        price = max(5.0, price + noise + (0.01 if i % 3 else -0.01))
        high = price + abs(noise) * 0.2 + 0.1
        low = price - abs(noise) * 0.2 - 0.1
        candles.append({
            "time": date,
            "open": round(price - 0.05, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(price, 2),
            "volume": round(vol + noise * 10000, 0),
        })
    return candles


CANDLES = make_candles(100)

ALL_INDICATORS = [
    "MACD", "DMA", "DMI", "TRIX", "FSL", "EMV",
    "RSI", "KDJ", "WR", "CCI", "ROC", "MTM", "PSY",
    "VOL", "OBV", "VR", "ASI", "BOLL", "SAR", "BRAR", "CR", "MOST",
]


def test_indicators_list():
    """GET /api/indicators/list returns all 22 indicators."""
    resp = client.get("/api/indicators/list")
    assert resp.status_code == 200
    data = resp.json()
    assert "indicators" in data
    returned = set(data["indicators"])
    for ind in ALL_INDICATORS:
        assert ind in returned, f"Indicator {ind} missing from list"


def test_calculate_returns_structure():
    """POST /api/indicators/calculate returns correct structure."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "MACD",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["indicator"] == "MACD"
    assert "series" in data
    assert isinstance(data["series"], list)
    assert len(data["series"]) > 0

    for s in data["series"]:
        assert "name" in s
        assert "type" in s
        assert s["type"] in ("line", "histogram")
        assert "data" in s
        assert isinstance(s["data"], list)


def test_macd_series_names():
    """MACD returns DIF, DEA, MACD series."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "MACD",
    })
    assert resp.status_code == 200
    data = resp.json()
    names = {s["name"] for s in data["series"]}
    assert "DIF" in names
    assert "DEA" in names
    assert "MACD" in names


def test_macd_histogram_has_colors():
    """MACD histogram data points have color field."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "MACD",
    })
    data = resp.json()
    hist = next(s for s in data["series"] if s["type"] == "histogram")
    assert len(hist["data"]) > 0
    for pt in hist["data"]:
        assert "color" in pt
        assert pt["color"] in ("#FF4444", "#00CC66")


def test_rsi_three_lines():
    """RSI returns RSI6, RSI12, RSI24 series."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "RSI",
    })
    assert resp.status_code == 200
    data = resp.json()
    names = {s["name"] for s in data["series"]}
    assert "RSI6" in names
    assert "RSI12" in names
    assert "RSI24" in names


def test_kdj_kdj_lines():
    """KDJ returns K, D, J series."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "KDJ",
    })
    assert resp.status_code == 200
    data = resp.json()
    names = {s["name"] for s in data["series"]}
    assert "K" in names
    assert "D" in names
    assert "J" in names


def test_boll_bands():
    """BOLL returns UPPER, MID, LOWER series."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "BOLL",
    })
    assert resp.status_code == 200
    data = resp.json()
    names = {s["name"] for s in data["series"]}
    assert "UPPER" in names
    assert "MID" in names
    assert "LOWER" in names


def test_dmi_lines():
    """DMI returns +DI, -DI, ADX, ADXR series."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "DMI",
    })
    assert resp.status_code == 200
    data = resp.json()
    names = {s["name"] for s in data["series"]}
    assert "+DI" in names
    assert "-DI" in names
    assert "ADX" in names


def test_vol_histogram_and_ma():
    """VOL returns histogram and MA lines."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "VOL",
    })
    assert resp.status_code == 200
    data = resp.json()
    types = {s["type"] for s in data["series"]}
    assert "histogram" in types
    names = {s["name"] for s in data["series"]}
    assert "VOL" in names


@pytest.mark.parametrize("indicator", ALL_INDICATORS)
def test_all_indicators_return_data(indicator: str):
    """All 22 indicators return non-empty series data."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": indicator,
    })
    assert resp.status_code == 200, f"{indicator} returned {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["indicator"] == indicator
    assert len(data["series"]) > 0, f"{indicator} returned empty series"
    # At least one series must have data points
    total_points = sum(len(s["data"]) for s in data["series"])
    assert total_points > 0, f"{indicator} returned zero data points"


@pytest.mark.parametrize("indicator", ALL_INDICATORS)
def test_all_indicators_values_are_finite(indicator: str):
    """All indicator values are finite numbers."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": indicator,
    })
    data = resp.json()
    for series in data["series"]:
        for pt in series["data"]:
            v = pt["value"]
            assert isinstance(v, (int, float)), f"{indicator}/{series['name']}: non-numeric value {v}"
            assert math.isfinite(v), f"{indicator}/{series['name']}: non-finite value {v}"


def test_unknown_indicator_returns_400():
    """Unknown indicator name returns 400."""
    resp = client.post("/api/indicators/calculate", json={
        "data": CANDLES,
        "indicator": "FOOBAR",
    })
    assert resp.status_code == 400


def test_empty_data_returns_400():
    """Empty data returns 400."""
    resp = client.post("/api/indicators/calculate", json={
        "data": [],
        "indicator": "MACD",
    })
    assert resp.status_code == 400


def test_data_with_date_key():
    """Backend accepts 'date' key as well as 'time' key."""
    candles_with_date = [
        {k.replace("time", "date"): v for k, v in c.items()}
        for c in CANDLES[:50]
    ]
    resp = client.post("/api/indicators/calculate", json={
        "data": candles_with_date,
        "indicator": "RSI",
    })
    assert resp.status_code == 200
