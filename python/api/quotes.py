"""GET /api/data/quotes — real-time quotes with 30s in-memory cache."""
from __future__ import annotations

import os
import time
import random
from typing import Any

from fastapi import APIRouter

router = APIRouter()

# ── 30-second in-memory cache ──────────────────────────────────────────────
_cache: list[dict] = []
_cache_ts: float = 0.0
_CACHE_TTL = 30.0  # seconds


def _mock_quotes() -> list[dict]:
    """Generate fake real-time quotes for 8 mock stocks."""
    STOCKS = [
        {"code": "000001", "name": "平安银行", "base": 12.0},
        {"code": "600519", "name": "贵州茅台", "base": 1800.0},
        {"code": "000858", "name": "五粮液", "base": 160.0},
        {"code": "601318", "name": "中国平安", "base": 50.0},
        {"code": "000002", "name": "万科A", "base": 10.0},
        {"code": "600036", "name": "招商银行", "base": 35.0},
        {"code": "002594", "name": "比亚迪", "base": 250.0},
        {"code": "601012", "name": "隆基绿能", "base": 25.0},
    ]
    rng = random.Random(int(time.time() // 30))  # changes every 30s
    results = []
    for s in STOCKS:
        base = s["base"]
        prev_close = round(base * rng.uniform(0.97, 1.03), 2)
        change_pct = rng.uniform(-0.05, 0.05)
        price = round(prev_close * (1 + change_pct), 2)
        change_amount = round(price - prev_close, 2)
        open_price = round(prev_close * rng.uniform(0.99, 1.01), 2)
        high = round(max(price, open_price) * rng.uniform(1.0, 1.02), 2)
        low = round(min(price, open_price) * rng.uniform(0.98, 1.0), 2)
        volume = round(1_000_000 * rng.uniform(0.5, 2.5))
        amount = round(volume * price * rng.uniform(0.95, 1.05), 2)
        turnover_rate = round(rng.uniform(0.5, 5.0), 2)
        pe_ratio = round(rng.uniform(10.0, 50.0), 2)
        amplitude = round((high - low) / prev_close * 100, 2) if prev_close else 0.0
        quantity_ratio = round(rng.uniform(0.5, 3.0), 2)
        results.append({
            "code": s["code"],
            "name": s["name"],
            "price": price,
            "change_pct": round(change_pct * 100, 2),
            "change_amount": change_amount,
            "volume": volume,
            "amount": amount,
            "open": open_price,
            "prev_close": prev_close,
            "high": high,
            "low": low,
            "turnover_rate": turnover_rate,
            "pe_ratio": pe_ratio,
            "amplitude": amplitude,
            "quantity_ratio": quantity_ratio,
        })
    return results


def _fetch_akshare_quotes() -> list[dict]:
    """Fetch real-time quotes from AKShare."""
    import akshare as ak
    df = ak.stock_zh_a_spot_em()
    results = []
    for _, row in df.iterrows():
        try:
            results.append({
                "code": str(row.get("代码", "")),
                "name": str(row.get("名称", "")),
                "price": float(row.get("最新价", 0) or 0),
                "change_pct": float(row.get("涨跌幅", 0) or 0),
                "change_amount": float(row.get("涨跌额", 0) or 0),
                "volume": float(row.get("成交量", 0) or 0),
                "amount": float(row.get("成交额", 0) or 0),
                "open": float(row.get("今开", 0) or 0),
                "prev_close": float(row.get("昨收", 0) or 0),
                "high": float(row.get("最高", 0) or 0),
                "low": float(row.get("最低", 0) or 0),
                "turnover_rate": float(row.get("换手率", 0) or 0),
                "pe_ratio": float(row.get("市盈率-动态", 0) or 0),
                "amplitude": float(row.get("振幅", 0) or 0),
                "quantity_ratio": float(row.get("量比", 0) or 0),
            })
        except Exception:
            continue
    return results


def _use_mock() -> bool:
    """Return True if running in mock mode (test or forced via env var)."""
    return os.environ.get("STOCKVISION_ADAPTER", "akshare").lower() == "mock"


@router.get("/api/data/quotes")
def get_quotes() -> list[dict]:
    """Return real-time quotes for all A-share stocks (30s cache)."""
    global _cache, _cache_ts

    now = time.time()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    if _use_mock():
        data = _mock_quotes()
    else:
        try:
            data = _fetch_akshare_quotes()
            if not data:
                raise ValueError("empty response")
        except Exception:
            data = _mock_quotes()

    _cache = data
    _cache_ts = now
    return data
