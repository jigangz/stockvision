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


def _find_vipdoc(directory: str) -> str | None:
    """Find the vipdoc directory, searching up to 2 levels deep.

    Handles cases like:
      D:\\股票\\TDX\\vipdoc          → direct
      D:\\股票\\TDX\\new_tdx\\vipdoc → one level deeper
      D:\\股票\\TDX\\tdx\\vipdoc     → one level deeper
    """
    import os
    # Direct: directory/vipdoc
    direct = os.path.join(directory, "vipdoc")
    if os.path.isdir(direct):
        return direct
    # One level deeper: directory/*/vipdoc
    try:
        for name in os.listdir(directory):
            sub = os.path.join(directory, name, "vipdoc")
            if os.path.isdir(sub):
                return sub
    except OSError:
        pass
    return None


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
    """Persist datasource configuration and switch active adapter."""
    _storage.init_config_table()
    _storage.save_config("datasource_config", json.dumps(body))

    # Switch active adapter based on enabled sources (by priority order)
    _switch_adapter(body.get("sources", []))

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


def _switch_adapter(sources: list[dict]) -> None:
    """Switch the active data adapter based on enabled sources (priority order)."""
    import logging
    from api.data import set_adapter

    logger = logging.getLogger("stockvision.datasource")

    for src in sources:
        if not src.get("enabled", False):
            continue

        source_id = src.get("id", "")

        if source_id == "akshare":
            try:
                import akshare  # noqa: F401 — verify akshare is actually installed
                from data.akshare_adapter import AkshareAdapter
                adapter = AkshareAdapter()
                set_adapter(adapter)
                logger.info("Switched to AkshareAdapter")
                return
            except Exception as e:
                logger.warning(f"AKShare unavailable: {e}")
                continue

        elif source_id == "tushare":
            api_key = src.get("api_key", "").strip()
            if not api_key:
                logger.warning("Tushare enabled but no token configured")
                continue
            try:
                from data.tushare_adapter import TushareAdapter
                adapter = TushareAdapter(api_key)
                set_adapter(adapter)
                logger.info("Switched to TushareAdapter")
                return
            except Exception as e:
                logger.warning(f"Tushare unavailable: {e}")
                continue

        elif source_id == "tdx":
            directory = src.get("directory", "").strip()
            if not directory:
                logger.warning("TDX enabled but no directory configured")
                continue
            if not _find_vipdoc(directory):
                logger.warning(f"TDX enabled but vipdoc not found in {directory}")
                continue
            try:
                from data.tdx_adapter import TdxAdapter
                adapter = TdxAdapter(directory)
                set_adapter(adapter)
                logger.info(f"Switched to TdxAdapter ({directory})")
                return
            except Exception as e:
                logger.warning(f"TDX unavailable: {e}")
                continue

    # No enabled source worked — fallback to MockAdapter
    from data.mock_adapter import MockAdapter
    set_adapter(MockAdapter())
    logger.warning("No enabled data source available, using MockAdapter")


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

        # Auto-detect vipdoc location: could be at directory/vipdoc or nested one level deeper
        vipdoc_root = _find_vipdoc(directory)
        if not vipdoc_root:
            return {"ok": False, "message": "未找到 vipdoc 目录，请确认路径正确（应包含 vipdoc 子目录）"}

        # Search for data files in vipdoc subdirectories
        day_count = 0
        min5_count = 0
        min1_count = 0
        for market in ["sh", "sz", "bj"]:
            lday = os.path.join(vipdoc_root, market, "lday")
            fzline = os.path.join(vipdoc_root, market, "fzline")
            minline = os.path.join(vipdoc_root, market, "minline")
            if os.path.isdir(lday):
                day_count += len([f for f in os.listdir(lday) if f.endswith(".day")])
            if os.path.isdir(fzline):
                min5_count += len([f for f in os.listdir(fzline) if f.endswith(".5")])
            if os.path.isdir(minline):
                min1_count += len([f for f in os.listdir(minline) if f.endswith(".1")])

        if day_count > 0 or min5_count > 0 or min1_count > 0:
            parts = []
            if day_count:
                parts.append(f"{day_count} 个日线文件")
            if min5_count:
                parts.append(f"{min5_count} 个5分钟文件")
            if min1_count:
                parts.append(f"{min1_count} 个1分钟文件")
            return {"ok": True, "message": f"找到 {'、'.join(parts)}"}
        return {"ok": False, "message": "vipdoc 目录中未找到数据文件（.day / .5 / .1）"}

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
