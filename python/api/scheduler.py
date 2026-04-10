"""
Background scheduler for daily data sync.

Uses APScheduler to run a daily sync job at a configurable time (default 15:30).
The scheduler reads config from SQLite and syncs kline data from the active adapter.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Body

logger = logging.getLogger("stockvision.scheduler")

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

# Scheduler singleton
_scheduler = None
_sync_job_id = "daily_sync"


def _get_adapter():
    """Get the current data adapter from the data module."""
    from api.data import _adapter
    return _adapter


def _get_config() -> dict:
    """Load datasource config from SQLite."""
    from data import storage as _storage
    _storage.init_config_table()
    raw = _storage.load_config("datasource_config")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return {"sync_time": "15:30", "auto_sync": True}


def _do_sync():
    """Execute the daily sync job."""
    logger.info("Daily sync job started")

    adapter = _get_adapter()
    if adapter is None:
        logger.warning("No adapter configured, skipping sync")
        return

    adapter_name = type(adapter).__name__
    if adapter_name == "MockAdapter":
        logger.info("MockAdapter active — sync is a no-op")
        _save_sync_status("completed", "MockAdapter — no real sync needed")
        return

    try:
        # Fetch stock list first
        from data import storage as _storage

        stocks = adapter.fetch_stock_list()
        if stocks:
            _storage.save_stock_list(stocks)
            logger.info(f"Synced stock list: {len(stocks)} stocks")

        # Sync daily kline for configured stocks (or top watchlist stocks)
        _storage.init_config_table()
        watchlist_raw = _storage.load_config("watchlist")
        codes_to_sync: list[str] = []
        if watchlist_raw:
            try:
                wl = json.loads(watchlist_raw)
                if isinstance(wl, list):
                    codes_to_sync = wl[:50]  # limit to 50 stocks per sync
            except Exception:
                pass

        if not codes_to_sync:
            # Default: sync a few major indices/stocks
            codes_to_sync = ["000001", "600519", "000858", "601318"]

        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        synced = 0
        errors = 0

        for code in codes_to_sync:
            market = "SH" if code.startswith("6") else "SZ"
            try:
                candles = adapter.fetch_kline(code, market, "daily", start_date, end_date)
                if candles:
                    _storage.save_candles(candles, code, market, "daily")
                    synced += 1
            except Exception as e:
                logger.warning(f"Sync failed for {code}: {e}")
                errors += 1

        msg = f"Synced {synced}/{len(codes_to_sync)} stocks, {errors} errors"
        logger.info(f"Daily sync completed: {msg}")
        _save_sync_status("completed", msg)

    except Exception as e:
        logger.error(f"Daily sync failed: {e}")
        _save_sync_status("failed", str(e))


def _save_sync_status(status: str, message: str):
    """Persist last sync status to config."""
    from data import storage as _storage
    _storage.init_config_table()
    _storage.save_config("last_sync", json.dumps({
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": status,
        "message": message,
    }))


def init_scheduler():
    """Initialize and start the APScheduler background scheduler."""
    global _scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning("APScheduler not installed, daily sync disabled. Run: pip install apscheduler")
        return

    config = _get_config()
    if not config.get("auto_sync", True):
        logger.info("Auto sync is disabled in config")
        return

    sync_time = config.get("sync_time", "15:30")
    try:
        hour, minute = map(int, sync_time.split(":"))
    except Exception:
        hour, minute = 15, 30

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _do_sync,
        trigger=CronTrigger(hour=hour, minute=minute, day_of_week="mon-fri"),
        id=_sync_job_id,
        replace_existing=True,
        name="Daily K-line sync",
    )
    _scheduler.start()
    logger.info(f"Scheduler started — daily sync at {hour:02d}:{minute:02d} (Mon-Fri)")


def reschedule(sync_time: str, auto_sync: bool):
    """Update the scheduler with new config."""
    global _scheduler

    if _scheduler is None:
        if auto_sync:
            init_scheduler()
        return

    if not auto_sync:
        _scheduler.remove_job(_sync_job_id)
        logger.info("Daily sync job removed (auto_sync disabled)")
        return

    try:
        from apscheduler.triggers.cron import CronTrigger
        hour, minute = map(int, sync_time.split(":"))
        _scheduler.reschedule_job(
            _sync_job_id,
            trigger=CronTrigger(hour=hour, minute=minute, day_of_week="mon-fri"),
        )
        logger.info(f"Rescheduled daily sync to {hour:02d}:{minute:02d}")
    except Exception as e:
        logger.warning(f"Failed to reschedule: {e}")


# ── API endpoints ──

@router.get("/status")
def get_sync_status() -> dict:
    """Get scheduler status and last sync info."""
    from data import storage as _storage
    _storage.init_config_table()
    raw = _storage.load_config("last_sync")
    last_sync = None
    if raw:
        try:
            last_sync = json.loads(raw)
        except Exception:
            pass

    scheduler_running = _scheduler is not None and _scheduler.running if _scheduler else False
    next_run = None
    if _scheduler and scheduler_running:
        job = _scheduler.get_job(_sync_job_id)
        if job and job.next_run_time:
            next_run = job.next_run_time.strftime("%Y-%m-%d %H:%M:%S")

    return {
        "scheduler_running": scheduler_running,
        "next_run": next_run,
        "last_sync": last_sync,
    }


@router.post("/trigger")
def trigger_sync_now() -> dict:
    """Manually trigger an immediate sync."""
    import threading
    t = threading.Thread(target=_do_sync, daemon=True)
    t.start()
    return {"ok": True, "message": "同步已触发，后台执行中"}


@router.post("/config")
def update_scheduler_config(body: dict = Body(...)) -> dict:
    """Update scheduler config and reschedule."""
    sync_time = body.get("sync_time", "15:30")
    auto_sync = body.get("auto_sync", True)
    reschedule(sync_time, auto_sync)
    return {"ok": True}
