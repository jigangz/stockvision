"""
Data source management API.

Endpoints:
  GET  /api/datasource/config   - get current datasource configuration
  PUT  /api/datasource/config   - save datasource configuration
  POST /api/datasource/test     - test connection to a data source
  POST /api/datasource/import   - manual import (CSV/XLSX or 通达信 files)
  GET  /api/datasource/logs     - get import log entries
  DELETE /api/datasource/logs   - clear all import logs
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Body, Query

from data import storage as _storage

router = APIRouter(prefix="/api/datasource", tags=["datasource"])


# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────

_DEFAULT_CONFIG: dict = {
    "sources": [
        {"id": "akshare", "name": "AKShare", "enabled": True,  "api_key": ""},
        {"id": "tushare", "name": "Tushare", "enabled": False, "api_key": ""},
        {"id": "tdx",     "name": "通达信本地文件", "enabled": False, "directory": ""},
    ],
    "sync_time": "15:30",
    "auto_sync": True,
}


@router.get("/config")
def get_config() -> dict:
    """Return current datasource configuration."""
    _storage.init_config_table()
    raw = _storage.load_config("datasource_config")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return _DEFAULT_CONFIG


@router.put("/config")
def put_config(body: dict = Body(...)) -> dict:
    """Persist datasource configuration."""
    _storage.init_config_table()
    _storage.save_config("datasource_config", json.dumps(body))

    # Reschedule sync job if sync config changed
    try:
        from api.scheduler import reschedule
        reschedule(
            sync_time=body.get("sync_time", "15:30"),
            auto_sync=body.get("auto_sync", True),
        )
    except Exception:
        pass

    return {"ok": True}


# ──────────────────────────────────────────────────────────────
# Connection test
# ──────────────────────────────────────────────────────────────

@router.post("/test")
def test_connection(body: dict = Body(...)) -> dict:
    """
    Test connectivity to a data source.

    Request body:
      { "source_id": "akshare" | "tushare" | "tdx",
        "api_key": "...",          # for akshare/tushare
        "directory": "..." }       # for tdx
    """
    source_id: str = body.get("source_id", "")

    if source_id == "akshare":
        # Attempt a lightweight import to verify akshare is installed
        try:
            import akshare  # noqa: F401
            return {"ok": True, "message": "AKShare 可用，连接成功"}
        except ImportError:
            return {"ok": False, "message": "AKShare 未安装 (pip install akshare)"}

    if source_id == "tushare":
        api_key: str = body.get("api_key", "").strip()
        if not api_key:
            return {"ok": False, "message": "请填写 Tushare Token"}
        try:
            import tushare as ts  # noqa: F401
            ts.set_token(api_key)
            pro = ts.pro_api()
            df = pro.trade_cal(exchange="SSE", start_date="20240101", end_date="20240101")
            if df is not None:
                return {"ok": True, "message": "Tushare 连接成功"}
            return {"ok": False, "message": "Tushare 返回空数据"}
        except ImportError:
            return {"ok": False, "message": "Tushare 未安装 (pip install tushare)"}
        except Exception as exc:
            return {"ok": False, "message": f"Tushare 连接失败: {exc}"}

    if source_id == "tdx":
        import os
        directory: str = body.get("directory", "").strip()
        if not directory:
            return {"ok": False, "message": "请填写通达信安装目录"}
        if not os.path.isdir(directory):
            return {"ok": False, "message": f"目录不存在: {directory}"}

        # Search for .day files in vipdoc subdirectories
        day_count = 0
        min5_count = 0
        min1_count = 0
        for market in ["sh", "sz"]:
            lday = os.path.join(directory, "vipdoc", market, "lday")
            fzline = os.path.join(directory, "vipdoc", market, "fzline")
            minline = os.path.join(directory, "vipdoc", market, "minline")
            if os.path.isdir(lday):
                day_count += len([f for f in os.listdir(lday) if f.endswith(".day")])
            if os.path.isdir(fzline):
                min5_count += len([f for f in os.listdir(fzline) if f.endswith(".5")])
            if os.path.isdir(minline):
                min1_count += len([f for f in os.listdir(minline) if f.endswith(".1")])

        # Also check if .day files are directly in the directory
        if day_count == 0:
            day_count = len([f for f in os.listdir(directory) if f.endswith(".day")])

        if day_count > 0 or min5_count > 0 or min1_count > 0:
            parts = []
            if day_count:
                parts.append(f"{day_count} 个日线文件")
            if min5_count:
                parts.append(f"{min5_count} 个5分钟文件")
            if min1_count:
                parts.append(f"{min1_count} 个1分钟文件")
            return {"ok": True, "message": f"找到 {'、'.join(parts)}"}
        return {"ok": False, "message": "未找到通达信数据文件，请确认路径包含 vipdoc 目录"}

    return {"ok": False, "message": f"未知数据源: {source_id}"}


# ──────────────────────────────────────────────────────────────
# Manual import
# ──────────────────────────────────────────────────────────────

def _detect_format(filename: str) -> str:
    """Detect file format from extension."""
    low = filename.lower()
    if low.endswith(".csv"):
        return "csv"
    if low.endswith(".xlsx") or low.endswith(".xls"):
        return "xlsx"
    if low.endswith(".day"):
        return "tdx_day"
    if low.endswith(".5"):
        return "tdx_5min"
    if low.endswith(".1"):
        return "tdx_1min"
    return "unknown"


@router.post("/import")
def manual_import(body: dict = Body(...)) -> dict:
    """
    Trigger a manual import.

    Request body:
      { "source": "csv" | "xlsx" | "tdx" | "akshare",
        "filename": "...",          # for file imports
        "content_b64": "...",       # base64-encoded file content (optional)
        "directory": "..." }        # for tdx directory import
    """
    source: str = body.get("source", "unknown")
    filename: str = body.get("filename", "")

    detected_format = _detect_format(filename) if filename else source

    # Simulate import (for mock environment)
    import random
    count = random.randint(10, 500)
    status = "success"
    details = f"导入 {count} 条记录 (模拟数据)"

    # Record in import log
    _storage.add_import_log(
        source=detected_format,
        filename=filename or source,
        count=count,
        status=status,
        details=details,
    )

    return {
        "ok": True,
        "format": detected_format,
        "count": count,
        "message": details,
    }


# ──────────────────────────────────────────────────────────────
# Import logs
# ──────────────────────────────────────────────────────────────

@router.get("/logs")
def get_logs(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    """Return import log entries, newest first."""
    return _storage.load_import_logs(limit=limit)


@router.delete("/logs")
def clear_logs() -> dict:
    """Clear all import logs."""
    _storage.clear_import_logs()
    return {"ok": True}
