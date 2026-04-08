import sys
from pathlib import Path

# Add python package root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["adapter"] == "MockAdapter"


def test_kline_endpoint():
    resp = client.get("/api/data/kline", params={
        "code": "000001",
        "market": "SZ",
        "period": "daily",
        "start": "2024-01-01",
        "end": "2024-12-31",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "000001"
    assert data["market"] == "SZ"
    assert len(data["data"]) > 200


def test_kline_data_structure():
    resp = client.get("/api/data/kline", params={
        "code": "600519",
        "market": "SH",
        "period": "daily",
        "start": "2024-06-01",
        "end": "2024-06-30",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) > 0

    candle = data["data"][0]
    assert "date" in candle
    assert "open" in candle
    assert "high" in candle
    assert "low" in candle
    assert "close" in candle
    assert "volume" in candle


def test_stocks_endpoint():
    resp = client.get("/api/data/stocks")
    assert resp.status_code == 200
    data = resp.json()
    assert "stocks" in data
    assert len(data["stocks"]) >= 5

    stock = data["stocks"][0]
    assert "code" in stock
    assert "name" in stock
    assert "market" in stock
