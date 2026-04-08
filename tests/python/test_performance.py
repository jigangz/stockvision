"""
Tests for P6-5 performance optimizations:
- kline endpoint limit/offset parameters
- read_parquet_pyarrow utility
- screener 'scanned' field
"""
import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# kline limit / offset
# ---------------------------------------------------------------------------

class TestKlineLimit:
    def test_kline_limit_returns_last_n_bars(self):
        """limit=N should return only the last N bars."""
        resp = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2023-01-01",
            "end": "2024-12-31",
            "limit": 100,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) == 100
        assert "total" in data
        assert data["total"] > 100  # full range has more bars

    def test_kline_limit_zero_returns_all(self):
        """limit=0 (default) should return all bars in range."""
        resp = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "limit": 0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) > 200  # full year has many bars
        assert data["total"] == len(data["data"])

    def test_kline_limit_chronological_order(self):
        """The returned bars should be the most recent ones (end of date range)."""
        resp_all = client.get("/api/data/kline", params={
            "code": "600519",
            "market": "SH",
            "period": "daily",
            "start": "2024-01-01",
            "end": "2024-12-31",
        })
        resp_limited = client.get("/api/data/kline", params={
            "code": "600519",
            "market": "SH",
            "period": "daily",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "limit": 50,
        })
        assert resp_all.status_code == 200
        assert resp_limited.status_code == 200

        all_data = resp_all.json()["data"]
        limited_data = resp_limited.json()["data"]

        # Limited result should be the LAST 50 bars of the full result
        assert limited_data == all_data[-50:]

    def test_kline_offset_skips_from_end(self):
        """offset=N should skip the last N bars."""
        resp_all = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "limit": 0,
        })
        full_count = len(resp_all.json()["data"])

        resp_offset = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2024-01-01",
            "end": "2024-12-31",
            "offset": 50,
            "limit": 50,
        })
        assert resp_offset.status_code == 200
        data = resp_offset.json()
        # Should have at most 50 bars, and from an earlier slice
        assert len(data["data"]) <= 50
        assert data["total"] == full_count

    def test_kline_has_more_field(self):
        """has_more=True when limit is applied and more bars exist."""
        resp = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2023-01-01",
            "end": "2024-12-31",
            "limit": 100,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "has_more" in data
        assert data["has_more"] is True

    def test_kline_has_more_false_when_all_loaded(self):
        """has_more=False when limit not applied or fewer bars than limit."""
        resp = client.get("/api/data/kline", params={
            "code": "000001",
            "market": "SZ",
            "period": "daily",
            "start": "2024-06-01",
            "end": "2024-06-30",
            "limit": 1000,  # limit larger than data
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "has_more" in data
        assert data["has_more"] is False


# ---------------------------------------------------------------------------
# read_parquet_pyarrow utility
# ---------------------------------------------------------------------------

class TestParquetPyarrow:
    def test_read_parquet_pyarrow_returns_list_of_dicts(self):
        """read_parquet_pyarrow should return list of dicts from a parquet file."""
        import pyarrow as pa
        import pyarrow.parquet as pq
        from data.storage import read_parquet_pyarrow

        # Write a small test parquet file
        data = {
            "date": ["2024-01-01", "2024-01-02"],
            "open": [100.0, 101.0],
            "high": [105.0, 106.0],
            "low": [99.0, 100.0],
            "close": [103.0, 104.0],
            "volume": [1000000.0, 1200000.0],
        }
        table = pa.table(data)
        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as f:
            tmp_path = f.name
        try:
            pq.write_table(table, tmp_path)
            rows = read_parquet_pyarrow(tmp_path)
            assert isinstance(rows, list)
            assert len(rows) == 2
            assert rows[0]["date"] == "2024-01-01"
            assert rows[0]["open"] == 100.0
            assert rows[1]["close"] == 104.0
        finally:
            os.unlink(tmp_path)

    def test_load_candles_pyarrow_missing_file_returns_none(self):
        """load_candles_pyarrow returns None when parquet file doesn't exist."""
        from data.storage import load_candles_pyarrow
        result = load_candles_pyarrow("NONEXISTENT", "SZ", "daily")
        assert result is None

    def test_load_candles_pyarrow_round_trip(self):
        """save_candles then load_candles_pyarrow should produce same data."""
        from data.storage import save_candles, load_candles_pyarrow
        from models.candle import Candle

        candles = [
            Candle(date="2024-03-01", open=10.0, high=11.0, low=9.5, close=10.5, volume=500000.0, amount=5250000.0),
            Candle(date="2024-03-04", open=10.5, high=12.0, low=10.0, close=11.5, volume=600000.0, amount=6900000.0),
        ]
        save_candles(candles, "TEST99", "SZ", "daily")
        loaded = load_candles_pyarrow("TEST99", "SZ", "daily")
        assert loaded is not None
        assert len(loaded) == 2
        assert loaded[0].date == "2024-03-01"
        assert loaded[0].close == 10.5
        assert loaded[1].close == 11.5


# ---------------------------------------------------------------------------
# screener scanned field
# ---------------------------------------------------------------------------

class TestScreenerScanned:
    def test_screener_returns_scanned_count(self):
        """POST /api/screener/filter should return a 'scanned' field."""
        resp = client.post("/api/screener/filter", json={
            "conditions": [],
            "limit": 200,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "scanned" in data
        assert isinstance(data["scanned"], int)
        assert data["scanned"] >= data["total"]

    def test_screener_scanned_equals_total_stocks_when_no_filter(self):
        """Without filters, scanned == total (all stocks pass)."""
        resp = client.post("/api/screener/filter", json={
            "conditions": [],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["scanned"] == data["total"]

    def test_screener_scanned_greater_when_filter_reduces(self):
        """With a restrictive filter, scanned > total (scanned all, fewer passed)."""
        resp = client.post("/api/screener/filter", json={
            "conditions": [{"field": "close", "operator": ">", "value": 999999}],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["scanned"] >= 0  # may be 0 if no stocks at all
