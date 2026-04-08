"""Tests for GET /api/capital_flow endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from main import app

client = TestClient(app)

STOCK_CODE = "000001"
STOCK_MARKET = "SZ"


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _get_flow(code: str = STOCK_CODE, market: str = STOCK_MARKET, period: str = "daily") -> dict:
    res = client.get(f"/api/capital_flow?code={code}&market={market}&period={period}")
    assert res.status_code == 200, res.text
    return res.json()


# ──────────────────────────────────────────────
# Top-level structure
# ──────────────────────────────────────────────

def test_response_top_level_keys():
    data = _get_flow()
    assert "code" in data
    assert "market" in data
    assert "period" in data
    assert "today" in data
    assert "history" in data


def test_response_reflects_query_params():
    data = _get_flow(code="600519", market="SH")
    assert data["code"] == "600519"
    assert data["market"] == "SH"


def test_history_is_list():
    data = _get_flow()
    assert isinstance(data["history"], list)
    assert len(data["history"]) > 0


def test_today_is_not_none():
    data = _get_flow()
    assert data["today"] is not None


def test_today_matches_last_history_entry():
    data = _get_flow()
    assert data["today"]["date"] == data["history"][-1]["date"]


# ──────────────────────────────────────────────
# Category fields
# ──────────────────────────────────────────────

REQUIRED_CATEGORY_FIELDS = {
    "buy_amount", "sell_amount", "net_amount",
    "buy_volume", "sell_volume", "net_volume",
}
REQUIRED_CATEGORIES = {"large", "medium", "small"}


def test_today_has_all_categories():
    data = _get_flow()
    today = data["today"]
    missing = REQUIRED_CATEGORIES - set(today.keys())
    assert not missing, f"Missing categories: {missing}"


def test_today_categories_have_all_fields():
    data = _get_flow()
    for cat in REQUIRED_CATEGORIES:
        cat_data = data["today"][cat]
        missing = REQUIRED_CATEGORY_FIELDS - set(cat_data.keys())
        assert not missing, f"Category '{cat}' missing fields: {missing}"


def test_history_entries_have_date_and_categories():
    data = _get_flow()
    for entry in data["history"]:
        assert "date" in entry, "Missing 'date' in history entry"
        missing = REQUIRED_CATEGORIES - set(entry.keys())
        assert not missing, f"History entry missing categories: {missing}"


def test_history_category_fields():
    data = _get_flow()
    for entry in data["history"]:
        for cat in REQUIRED_CATEGORIES:
            cat_data = entry[cat]
            missing = REQUIRED_CATEGORY_FIELDS - set(cat_data.keys())
            assert not missing, f"History category '{cat}' missing fields: {missing}"


# ──────────────────────────────────────────────
# Data quality
# ──────────────────────────────────────────────

def test_buy_sell_volumes_positive():
    """Buy and sell volumes should be positive."""
    data = _get_flow()
    for cat in REQUIRED_CATEGORIES:
        cat_data = data["today"][cat]
        assert cat_data["buy_volume"] >= 0
        assert cat_data["sell_volume"] >= 0


def test_net_equals_buy_minus_sell():
    """net_amount = buy_amount - sell_amount (approximately)."""
    data = _get_flow()
    for cat in REQUIRED_CATEGORIES:
        cat_data = data["today"][cat]
        expected_net = cat_data["buy_amount"] - cat_data["sell_amount"]
        assert abs(expected_net - cat_data["net_amount"]) < 2, (
            f"{cat}: expected net_amount={expected_net} but got {cat_data['net_amount']}"
        )


def test_net_volume_equals_buy_minus_sell_volume():
    """net_volume = buy_volume - sell_volume (approximately)."""
    data = _get_flow()
    for cat in REQUIRED_CATEGORIES:
        cat_data = data["today"][cat]
        expected = cat_data["buy_volume"] - cat_data["sell_volume"]
        assert abs(expected - cat_data["net_volume"]) < 2, (
            f"{cat}: expected net_volume={expected} but got {cat_data['net_volume']}"
        )


def test_history_dates_ascending():
    """History dates should be in ascending order."""
    data = _get_flow()
    dates = [e["date"] for e in data["history"]]
    assert dates == sorted(dates), "History dates are not in ascending order"


def test_history_dates_are_strings():
    data = _get_flow()
    for entry in data["history"]:
        assert isinstance(entry["date"], str)
        assert len(entry["date"]) == 10, f"Date not YYYY-MM-DD: {entry['date']}"


def test_amounts_are_numeric():
    data = _get_flow()
    for cat in REQUIRED_CATEGORIES:
        cat_data = data["today"][cat]
        for field in REQUIRED_CATEGORY_FIELDS:
            assert isinstance(cat_data[field], (int, float)), (
                f"{cat}.{field} is not numeric: {cat_data[field]}"
            )


# ──────────────────────────────────────────────
# Multiple stocks
# ──────────────────────────────────────────────

def test_different_stocks_have_different_flow():
    """Two different stocks should produce different net amounts."""
    d1 = _get_flow(code="000001", market="SZ")
    d2 = _get_flow(code="600519", market="SH")
    # They might coincidentally equal, but check they are independently generated
    assert d1["code"] != d2["code"]
    # Large net amounts are unlikely to be identical
    n1 = d1["today"]["large"]["net_amount"]
    n2 = d2["today"]["large"]["net_amount"]
    assert n1 != n2, "Different stocks should produce different capital flow data"


def test_history_length_reasonable():
    """Should return a meaningful number of history entries."""
    data = _get_flow()
    assert 5 <= len(data["history"]) <= 50
