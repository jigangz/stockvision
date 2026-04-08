"""Tests for POST /api/screener/filter endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from main import app

client = TestClient(app)


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────

def _filter(conditions=None, formula=None, sort_by="change_pct", sort_desc=True, limit=200):
    body = {
        "conditions": conditions or [],
        "sort_by": sort_by,
        "sort_desc": sort_desc,
        "limit": limit,
    }
    if formula is not None:
        body["formula"] = formula
    res = client.post("/api/screener/filter", json=body)
    assert res.status_code == 200, res.text
    return res.json()


# ──────────────────────────────────────────────
# Basic structure
# ──────────────────────────────────────────────

def test_no_conditions_returns_all_stocks():
    """No conditions → all 8 mock stocks returned."""
    data = _filter()
    assert "total" in data
    assert "stocks" in data
    assert "fields" in data
    assert data["total"] == 8
    assert len(data["stocks"]) == 8


def test_stock_fields_present():
    """Each stock result has required fields."""
    data = _filter()
    required = {"code", "name", "market", "sector", "close", "open", "high",
                "low", "change_pct", "volume", "amount", "amplitude"}
    for stock in data["stocks"]:
        missing = required - set(stock.keys())
        assert not missing, f"Missing fields: {missing} in {stock}"


def test_no_internal_fields_leaked():
    """_candles must not appear in API response."""
    data = _filter()
    for stock in data["stocks"]:
        assert "_candles" not in stock


# ──────────────────────────────────────────────
# Field condition filtering
# ──────────────────────────────────────────────

def test_filter_by_close_gt():
    """Filter: close > 100 — only high-price stocks pass."""
    data = _filter(conditions=[{"field": "close", "operator": ">", "value": 100}])
    for stock in data["stocks"]:
        assert stock["close"] > 100, f"{stock['code']} close={stock['close']} should be > 100"


def test_filter_by_close_lt():
    """Filter: close < 50 — only low-price stocks pass."""
    data = _filter(conditions=[{"field": "close", "operator": "<", "value": 50}])
    for stock in data["stocks"]:
        assert stock["close"] < 50


def test_filter_excludes_all():
    """Impossible condition → 0 results."""
    data = _filter(conditions=[{"field": "close", "operator": ">", "value": 1_000_000}])
    assert data["total"] == 0
    assert data["stocks"] == []


def test_filter_includes_all():
    """Always-true condition → all stocks pass."""
    data = _filter(conditions=[{"field": "close", "operator": ">", "value": 0}])
    assert data["total"] == 8


def test_multiple_conditions_and_logic():
    """Two conditions are ANDed: both must hold."""
    data = _filter(conditions=[
        {"field": "close", "operator": ">", "value": 0},
        {"field": "volume", "operator": ">", "value": 0},
    ])
    # Both conditions trivially true → all 8 pass
    assert data["total"] == 8


def test_multiple_conditions_restrictive():
    """Contradictory conditions → 0 results."""
    data = _filter(conditions=[
        {"field": "change_pct", "operator": ">", "value": 100},   # impossible
        {"field": "change_pct", "operator": "<", "value": -100},  # also impossible
    ])
    assert data["total"] == 0


# ──────────────────────────────────────────────
# Operators
# ──────────────────────────────────────────────

def test_operator_gte():
    data_gt = _filter(conditions=[{"field": "close", "operator": ">", "value": 10}])
    data_gte = _filter(conditions=[{"field": "close", "operator": ">=", "value": 10}])
    # GTE should include at least as many as GT
    assert data_gte["total"] >= data_gt["total"]


def test_operator_lte():
    data_lt = _filter(conditions=[{"field": "close", "operator": "<", "value": 200}])
    data_lte = _filter(conditions=[{"field": "close", "operator": "<=", "value": 200}])
    assert data_lte["total"] >= data_lt["total"]


def test_operator_ne():
    """!= with impossible value → same as no filter."""
    data = _filter(conditions=[{"field": "close", "operator": "!=", "value": -999999}])
    assert data["total"] == 8


# ──────────────────────────────────────────────
# Sorting
# ──────────────────────────────────────────────

def test_default_sort_change_pct_desc():
    """Default sort: change_pct descending."""
    data = _filter(sort_by="change_pct", sort_desc=True)
    stocks = data["stocks"]
    if len(stocks) >= 2:
        for i in range(len(stocks) - 1):
            assert stocks[i]["change_pct"] >= stocks[i + 1]["change_pct"]


def test_sort_close_asc():
    """Sort by close ascending."""
    data = _filter(sort_by="close", sort_desc=False)
    stocks = data["stocks"]
    if len(stocks) >= 2:
        for i in range(len(stocks) - 1):
            assert stocks[i]["close"] <= stocks[i + 1]["close"]


def test_sort_volume_desc():
    """Sort by volume descending."""
    data = _filter(sort_by="volume", sort_desc=True)
    stocks = data["stocks"]
    if len(stocks) >= 2:
        for i in range(len(stocks) - 1):
            assert stocks[i]["volume"] >= stocks[i + 1]["volume"]


# ──────────────────────────────────────────────
# Limit
# ──────────────────────────────────────────────

def test_limit_respected():
    """limit=3 returns at most 3 stocks."""
    data = _filter(limit=3)
    assert len(data["stocks"]) <= 3
    # total still reflects all matches before limit
    assert data["total"] == 8


# ──────────────────────────────────────────────
# Formula-based screening
# ──────────────────────────────────────────────

def test_formula_always_true():
    """Formula 'CLOSE > 0' — all stocks have positive close price."""
    data = _filter(formula="CLOSE > 0")
    assert data["total"] == 8


def test_formula_always_false():
    """Formula 'CLOSE > 99999' — no stock passes."""
    data = _filter(formula="CLOSE > 99999")
    assert data["total"] == 0


def test_formula_ma_crossover():
    """Formula with MA function must not crash and returns valid response."""
    data = _filter(formula="CLOSE > MA(CLOSE, 5)")
    assert "total" in data
    assert "stocks" in data
    assert isinstance(data["total"], int)


def test_formula_combined_with_condition():
    """Formula + field condition both applied (AND logic)."""
    data_all = _filter(formula="CLOSE > 0")  # formula passes all
    data_combo = _filter(
        conditions=[{"field": "close", "operator": ">", "value": 100}],
        formula="CLOSE > 0",
    )
    # Combo should be <= all (conditions further restrict)
    assert data_combo["total"] <= data_all["total"]


# ──────────────────────────────────────────────
# Validation errors
# ──────────────────────────────────────────────

def test_unknown_field_returns_400():
    res = client.post("/api/screener/filter", json={
        "conditions": [{"field": "unknown_field", "operator": ">", "value": 0}]
    })
    assert res.status_code == 400


def test_unknown_operator_returns_400():
    res = client.post("/api/screener/filter", json={
        "conditions": [{"field": "close", "operator": "??", "value": 0}]
    })
    assert res.status_code == 400


# ──────────────────────────────────────────────
# GET /api/screener/fields
# ──────────────────────────────────────────────

def test_get_fields_endpoint():
    res = client.get("/api/screener/fields")
    assert res.status_code == 200
    data = res.json()
    assert "fields" in data
    assert "operators" in data
    assert len(data["fields"]) >= 8
    # Each field has key and label
    for f in data["fields"]:
        assert "key" in f
        assert "label" in f
