"""Tests for /api/datasource endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from main import app

client = TestClient(app)


# ──────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────

def test_get_config_returns_dict():
    res = client.get("/api/datasource/config")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)


def test_get_config_has_sources():
    data = client.get("/api/datasource/config").json()
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) > 0


def test_get_config_has_sync_time():
    data = client.get("/api/datasource/config").json()
    assert "sync_time" in data


def test_get_config_has_auto_sync():
    data = client.get("/api/datasource/config").json()
    assert "auto_sync" in data


def test_put_config_saves_and_returns():
    payload = {
        "sources": [
            {"id": "akshare", "name": "AKShare", "enabled": True, "api_key": ""},
        ],
        "sync_time": "16:00",
        "auto_sync": False,
    }
    res = client.put("/api/datasource/config", json=payload)
    assert res.status_code == 200
    assert res.json().get("ok") is True


def test_put_then_get_reflects_change():
    payload = {
        "sources": [
            {"id": "akshare", "name": "AKShare", "enabled": False, "api_key": "test123"},
        ],
        "sync_time": "09:30",
        "auto_sync": True,
    }
    client.put("/api/datasource/config", json=payload)
    data = client.get("/api/datasource/config").json()
    assert data["sync_time"] == "09:30"
    assert data["sources"][0]["enabled"] is False
    assert data["sources"][0]["api_key"] == "test123"


def test_config_source_has_required_fields():
    data = client.get("/api/datasource/config").json()
    for src in data["sources"]:
        assert "id" in src
        assert "name" in src
        assert "enabled" in src


# ──────────────────────────────────────────────
# Connection test
# ──────────────────────────────────────────────

def test_test_unknown_source():
    res = client.post("/api/datasource/test", json={"source_id": "nonexistent"})
    assert res.status_code == 200
    data = res.json()
    assert "ok" in data
    assert "message" in data
    assert data["ok"] is False


def test_test_tushare_no_token():
    res = client.post("/api/datasource/test", json={"source_id": "tushare", "api_key": ""})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is False
    assert "Token" in data["message"] or "token" in data["message"].lower()


def test_test_tdx_empty_dir():
    res = client.post("/api/datasource/test", json={"source_id": "tdx", "directory": ""})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is False


def test_test_tdx_nonexistent_dir():
    res = client.post("/api/datasource/test", json={"source_id": "tdx", "directory": "/nonexistent/path"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is False


def test_test_akshare_returns_result():
    """AKShare test should return ok=True (if installed) or False with message."""
    res = client.post("/api/datasource/test", json={"source_id": "akshare"})
    assert res.status_code == 200
    data = res.json()
    assert "ok" in data
    assert isinstance(data["ok"], bool)
    assert "message" in data


# ──────────────────────────────────────────────
# Manual import
# ──────────────────────────────────────────────

def test_import_csv():
    res = client.post("/api/datasource/import", json={"filename": "data.csv", "source": "csv"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["format"] == "csv"
    assert isinstance(data["count"], int)
    assert data["count"] > 0


def test_import_xlsx():
    res = client.post("/api/datasource/import", json={"filename": "data.xlsx", "source": "xlsx"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["format"] == "xlsx"


def test_import_tdx_day():
    res = client.post("/api/datasource/import", json={"filename": "sh000001.day", "source": "tdx_day"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["format"] == "tdx_day"


def test_import_tdx_5min():
    res = client.post("/api/datasource/import", json={"filename": "sh000001.5", "source": "tdx_5min"})
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "tdx_5min"


def test_import_tdx_1min():
    res = client.post("/api/datasource/import", json={"filename": "sh000001.1", "source": "tdx_1min"})
    assert res.status_code == 200
    data = res.json()
    assert data["format"] == "tdx_1min"


def test_import_unknown_format():
    res = client.post("/api/datasource/import", json={"filename": "data.txt", "source": "unknown"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True  # still succeeds in mock mode


def test_import_has_message():
    res = client.post("/api/datasource/import", json={"filename": "test.csv", "source": "csv"})
    data = res.json()
    assert "message" in data
    assert isinstance(data["message"], str)


# ──────────────────────────────────────────────
# Import logs
# ──────────────────────────────────────────────

def test_logs_returns_list():
    res = client.get("/api/datasource/logs")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_import_creates_log_entry():
    # Clear first
    client.delete("/api/datasource/logs")
    # Do an import
    client.post("/api/datasource/import", json={"filename": "test.csv", "source": "csv"})
    logs = client.get("/api/datasource/logs").json()
    assert len(logs) >= 1


def test_log_entry_has_required_fields():
    client.post("/api/datasource/import", json={"filename": "log_test.xlsx", "source": "xlsx"})
    logs = client.get("/api/datasource/logs").json()
    assert len(logs) > 0
    entry = logs[0]
    for field in ["id", "timestamp", "source", "filename", "count", "status"]:
        assert field in entry, f"Missing field: {field}"


def test_log_status_is_success():
    client.delete("/api/datasource/logs")
    client.post("/api/datasource/import", json={"filename": "ok.csv", "source": "csv"})
    logs = client.get("/api/datasource/logs").json()
    assert logs[0]["status"] == "success"


def test_log_count_is_positive():
    client.delete("/api/datasource/logs")
    client.post("/api/datasource/import", json={"filename": "count.csv", "source": "csv"})
    logs = client.get("/api/datasource/logs").json()
    assert logs[0]["count"] > 0


def test_logs_newest_first():
    """Logs should be returned newest first (DESC order)."""
    client.delete("/api/datasource/logs")
    client.post("/api/datasource/import", json={"filename": "first.csv", "source": "csv"})
    client.post("/api/datasource/import", json={"filename": "second.csv", "source": "csv"})
    logs = client.get("/api/datasource/logs").json()
    # newest first: second import should appear before first
    filenames = [l["filename"] for l in logs]
    assert filenames.index("second.csv") < filenames.index("first.csv")


def test_clear_logs():
    client.post("/api/datasource/import", json={"filename": "clear_test.csv", "source": "csv"})
    client.delete("/api/datasource/logs")
    logs = client.get("/api/datasource/logs").json()
    assert len(logs) == 0


def test_logs_limit_param():
    client.delete("/api/datasource/logs")
    for i in range(5):
        client.post("/api/datasource/import", json={"filename": f"file{i}.csv", "source": "csv"})
    logs = client.get("/api/datasource/logs?limit=3").json()
    assert len(logs) <= 3
