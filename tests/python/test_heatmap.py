"""Tests for GET /api/heatmap/sectors endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from main import app

client = TestClient(app)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _get_sectors() -> dict:
    res = client.get("/api/heatmap/sectors")
    assert res.status_code == 200, res.text
    return res.json()


# ──────────────────────────────────────────────
# Structure
# ──────────────────────────────────────────────

def test_response_structure():
    """Response has required top-level keys."""
    data = _get_sectors()
    assert "sectors" in data
    assert "total_sectors" in data
    assert "total_stocks" in data


def test_sectors_is_list():
    data = _get_sectors()
    assert isinstance(data["sectors"], list)
    assert len(data["sectors"]) > 0


def test_total_sectors_matches_list():
    data = _get_sectors()
    assert data["total_sectors"] == len(data["sectors"])


def test_total_stocks_matches_sum():
    data = _get_sectors()
    total = sum(s["stock_count"] for s in data["sectors"])
    assert data["total_stocks"] == total


# ──────────────────────────────────────────────
# Sector fields
# ──────────────────────────────────────────────

def test_sector_required_fields():
    """Each sector has all required fields."""
    data = _get_sectors()
    required = {"name", "change_pct", "volume", "market_cap", "stock_count", "stocks"}
    for sector in data["sectors"]:
        missing = required - set(sector.keys())
        assert not missing, f"Missing fields {missing} in sector {sector.get('name')}"


def test_sector_change_pct_is_float():
    data = _get_sectors()
    for sector in data["sectors"]:
        assert isinstance(sector["change_pct"], (int, float))


def test_sector_volume_positive():
    data = _get_sectors()
    for sector in data["sectors"]:
        assert sector["volume"] > 0, f"Sector {sector['name']} has non-positive volume"


def test_sector_market_cap_positive():
    data = _get_sectors()
    for sector in data["sectors"]:
        assert sector["market_cap"] > 0, f"Sector {sector['name']} has non-positive market_cap"


def test_sector_stock_count_matches_stocks_list():
    data = _get_sectors()
    for sector in data["sectors"]:
        assert sector["stock_count"] == len(sector["stocks"]), (
            f"Sector {sector['name']}: stock_count={sector['stock_count']} "
            f"but len(stocks)={len(sector['stocks'])}"
        )


# ──────────────────────────────────────────────
# Stock fields within sectors
# ──────────────────────────────────────────────

def test_stock_required_fields():
    """Each stock within a sector has all required fields."""
    data = _get_sectors()
    required = {"code", "name", "market", "sector", "close", "change_pct",
                "volume", "amount", "market_cap"}
    for sector in data["sectors"]:
        for stock in sector["stocks"]:
            missing = required - set(stock.keys())
            assert not missing, f"Missing fields {missing} in stock {stock.get('code')}"


def test_stock_close_positive():
    data = _get_sectors()
    for sector in data["sectors"]:
        for stock in sector["stocks"]:
            assert stock["close"] > 0


def test_stock_market_values():
    """Market is one of SH or SZ."""
    data = _get_sectors()
    for sector in data["sectors"]:
        for stock in sector["stocks"]:
            assert stock["market"] in ("SH", "SZ"), (
                f"Unexpected market {stock['market']} for {stock['code']}"
            )


def test_stock_sector_matches_parent():
    """Each stock's sector field matches its parent sector name."""
    data = _get_sectors()
    for sector in data["sectors"]:
        for stock in sector["stocks"]:
            assert stock["sector"] == sector["name"], (
                f"Stock {stock['code']} sector={stock['sector']} "
                f"but parent sector={sector['name']}"
            )


# ──────────────────────────────────────────────
# Data quality
# ──────────────────────────────────────────────

def test_all_mock_stocks_covered():
    """All 8 mock stocks appear across the sector data."""
    data = _get_sectors()
    all_codes = {s["code"] for sec in data["sectors"] for s in sec["stocks"]}
    expected = {"000001", "600519", "000858", "601318", "000002", "600036", "002594", "601012"}
    assert all_codes == expected


def test_no_duplicate_stocks():
    """Each stock code appears in exactly one sector."""
    data = _get_sectors()
    codes: list[str] = [s["code"] for sec in data["sectors"] for s in sec["stocks"]]
    assert len(codes) == len(set(codes)), "Duplicate stock codes found"


def test_sector_avg_change_pct_derived():
    """Sector change_pct should be close to the average of its stocks' change_pct."""
    data = _get_sectors()
    for sector in data["sectors"]:
        stocks = sector["stocks"]
        if not stocks:
            continue
        avg = sum(s["change_pct"] for s in stocks) / len(stocks)
        assert abs(avg - sector["change_pct"]) < 0.01, (
            f"Sector {sector['name']}: avg_change={avg:.3f} "
            f"but sector.change_pct={sector['change_pct']:.3f}"
        )


def test_sector_total_volume_derived():
    """Sector volume should equal sum of its stocks' volumes."""
    data = _get_sectors()
    for sector in data["sectors"]:
        expected = sum(s["volume"] for s in sector["stocks"])
        assert sector["volume"] == expected, (
            f"Sector {sector['name']}: expected volume {expected}, got {sector['volume']}"
        )
