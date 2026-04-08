"""Tests for POST /api/data/sync and POST /api/data/import endpoints (FIX-2)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from main import app  # noqa: E402

client = TestClient(app)


# ──────────────────────────────────────────────
# /api/data/sync
# ──────────────────────────────────────────────

def test_sync_returns_200():
    res = client.post("/api/data/sync", json={})
    assert res.status_code == 200


def test_sync_returns_ok_true():
    res = client.post("/api/data/sync", json={})
    data = res.json()
    assert data.get("ok") is True


def test_sync_with_codes():
    res = client.post("/api/data/sync", json={"codes": ["000001", "600000"], "period": "daily"})
    assert res.status_code == 200
    data = res.json()
    assert data.get("ok") is True
    assert data.get("synced") == 2


def test_sync_with_no_body():
    res = client.post("/api/data/sync")
    assert res.status_code == 200


def test_sync_returns_period():
    res = client.post("/api/data/sync", json={"period": "weekly"})
    data = res.json()
    assert data.get("period") == "weekly"


def test_sync_returns_message():
    res = client.post("/api/data/sync", json={})
    data = res.json()
    assert "message" in data


# ──────────────────────────────────────────────
# /api/data/import
# ──────────────────────────────────────────────

def test_import_returns_200():
    res = client.post("/api/data/import", json={"source": "csv", "filename": "test.csv"})
    assert res.status_code == 200


def test_import_returns_ok():
    res = client.post("/api/data/import", json={"source": "csv", "filename": "data.csv"})
    data = res.json()
    assert "ok" in data or "status" in data


def test_import_csv_format():
    res = client.post("/api/data/import", json={"source": "csv", "filename": "prices.csv"})
    assert res.status_code == 200
    data = res.json()
    assert data.get("format") in ("csv", None) or data.get("ok") in (True, False)


def test_import_xlsx_format():
    res = client.post("/api/data/import", json={"source": "xlsx", "filename": "data.xlsx"})
    assert res.status_code == 200


def test_import_tdx_format():
    res = client.post("/api/data/import", json={"source": "tdx", "directory": "/some/path"})
    assert res.status_code == 200


def test_import_no_body():
    res = client.post("/api/data/import")
    assert res.status_code == 200


def test_import_returns_count():
    res = client.post("/api/data/import", json={"source": "csv", "filename": "x.csv"})
    data = res.json()
    # Should have some numeric field indicating records imported
    assert any(isinstance(v, int) for v in data.values()), f"No int value in response: {data}"
