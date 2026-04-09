"""Tests for GET/PUT /api/config/watchlist endpoint (P7-2)."""
from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_watchlist_get_empty_default():
    """GET watchlist on fresh DB should return empty list."""
    # Clear any existing watchlist first
    client.put("/api/config/watchlist", json={"codes": []})
    res = client.get("/api/config/watchlist")
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)


def test_watchlist_crud():
    """Put a list, get it back — full CRUD cycle."""
    codes = ["000001", "600519", "002594"]

    # Put
    put_res = client.put("/api/config/watchlist", json={"codes": codes})
    assert put_res.status_code == 200, put_res.text
    put_data = put_res.json()
    assert put_data["codes"] == codes

    # Get — should return same list
    get_res = client.get("/api/config/watchlist")
    assert get_res.status_code == 200, get_res.text
    assert get_res.json() == codes


def test_watchlist_overwrite():
    """Putting a new list replaces the previous one."""
    client.put("/api/config/watchlist", json={"codes": ["000001", "600519"]})
    client.put("/api/config/watchlist", json={"codes": ["000858"]})
    res = client.get("/api/config/watchlist")
    assert res.json() == ["000858"]


def test_watchlist_empty_list():
    """Can persist an empty list."""
    client.put("/api/config/watchlist", json={"codes": ["000001"]})
    client.put("/api/config/watchlist", json={"codes": []})
    res = client.get("/api/config/watchlist")
    assert res.json() == []


def test_watchlist_response_structure():
    """PUT response includes codes key."""
    codes = ["601318", "000002"]
    res = client.put("/api/config/watchlist", json={"codes": codes})
    assert res.status_code == 200
    data = res.json()
    assert "codes" in data
    assert data["codes"] == codes
