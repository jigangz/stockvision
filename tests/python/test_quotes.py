"""Tests for GET /api/data/quotes endpoint (P7-1)."""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

REQUIRED_FIELDS = [
    "code", "name", "price", "change_pct", "change_amount",
    "volume", "amount", "open", "prev_close", "high", "low",
    "turnover_rate", "pe_ratio", "amplitude", "quantity_ratio",
]


def test_quotes_endpoint_status():
    res = client.get("/api/data/quotes")
    assert res.status_code == 200, res.text


def test_quotes_returns_list():
    res = client.get("/api/data/quotes")
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_quotes_expected_fields():
    res = client.get("/api/data/quotes")
    data = res.json()
    assert len(data) > 0
    first = data[0]
    for field in REQUIRED_FIELDS:
        assert field in first, f"Missing field: {field}"


def test_quotes_all_mock_stocks():
    """MockAdapter should return 8 stocks."""
    res = client.get("/api/data/quotes")
    data = res.json()
    assert len(data) == 8


def test_quotes_numeric_fields():
    res = client.get("/api/data/quotes")
    data = res.json()
    numeric_fields = [
        "price", "change_pct", "change_amount", "volume", "amount",
        "open", "prev_close", "high", "low",
        "turnover_rate", "pe_ratio", "amplitude", "quantity_ratio",
    ]
    for stock in data:
        for field in numeric_fields:
            assert isinstance(stock[field], (int, float)), (
                f"{field} should be numeric for {stock['code']}"
            )


def test_quotes_code_and_name_are_strings():
    res = client.get("/api/data/quotes")
    data = res.json()
    for stock in data:
        assert isinstance(stock["code"], str)
        assert isinstance(stock["name"], str)
        assert len(stock["code"]) > 0
        assert len(stock["name"]) > 0


def test_quotes_cache_returns_same_data():
    """Two rapid calls should return identical data (cached)."""
    res1 = client.get("/api/data/quotes")
    res2 = client.get("/api/data/quotes")
    assert res1.json() == res2.json()
