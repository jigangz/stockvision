"""
POST /api/screener/filter — filter stocks by field conditions and optional formula.
"""
from __future__ import annotations

import math
import operator as op_module
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/screener", tags=["screener"])

# Available fields and their display names
FIELDS: dict[str, str] = {
    "close": "最新价",
    "open": "开盘价",
    "high": "最高价",
    "low": "最低价",
    "change_pct": "涨幅%",
    "volume": "成交量",
    "amount": "成交额",
    "amplitude": "振幅%",
}

VALID_OPERATORS = {">", "<", ">=", "<=", "==", "!="}

_OPS: dict[str, Any] = {
    ">": op_module.gt,
    "<": op_module.lt,
    ">=": op_module.ge,
    "<=": op_module.le,
    "==": op_module.eq,
    "!=": op_module.ne,
}


class Condition(BaseModel):
    field: str
    operator: str
    value: float


class ScreenerRequest(BaseModel):
    conditions: list[Condition] = []
    formula: str | None = None
    sort_by: str = "change_pct"
    sort_desc: bool = True
    limit: int = 200


def _get_stock_metrics() -> list[dict]:
    """Generate latest-day metrics for all mock stocks using MockAdapter."""
    from data.mock_adapter import MockAdapter
    adapter = MockAdapter()

    today = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")

    metrics_list: list[dict] = []
    for stock in adapter.MOCK_STOCKS:
        code = stock["code"]
        market = stock["market"]
        try:
            candles = adapter.fetch_kline(code, market, "daily", start, today)
            if len(candles) < 2:
                continue
            last = candles[-1]
            prev = candles[-2]

            change_pct = (last.close - prev.close) / prev.close * 100 if prev.close else 0.0
            amplitude = (last.high - last.low) / prev.close * 100 if prev.close else 0.0

            metrics_list.append({
                "code": code,
                "name": stock["name"],
                "market": market,
                "sector": stock.get("sector", ""),
                "close": round(last.close, 2),
                "open": round(last.open, 2),
                "high": round(last.high, 2),
                "low": round(last.low, 2),
                "volume": round(last.volume, 0),
                "amount": round(last.amount, 2),
                "change_pct": round(change_pct, 2),
                "amplitude": round(amplitude, 2),
                # Private: candles for formula evaluation
                "_candles": [c.to_dict() for c in candles],
            })
        except Exception:
            continue

    return metrics_list


@router.get("/fields")
def get_fields() -> dict:
    """Return available fields and operators for the condition builder UI."""
    return {
        "fields": [{"key": k, "label": v} for k, v in FIELDS.items()],
        "operators": sorted(VALID_OPERATORS),
    }


@router.post("/filter")
def filter_stocks(req: ScreenerRequest) -> dict:
    """
    Filter stocks by field conditions (AND logic) and optional formula condition.

    Each condition: {field, operator, value}
    Optional formula is evaluated against each stock's recent candle data;
    a stock passes if the last value of the formula result is non-zero.
    """
    # Validate conditions
    for cond in req.conditions:
        if cond.field not in FIELDS:
            raise HTTPException(status_code=400, detail=f"Unknown field: {cond.field!r}")
        if cond.operator not in VALID_OPERATORS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown operator: {cond.operator!r}. Valid: {sorted(VALID_OPERATORS)}",
            )

    # Validate sort field
    valid_sort = set(FIELDS) | {"code", "name"}
    sort_by = req.sort_by if req.sort_by in valid_sort else "change_pct"

    stocks = _get_stock_metrics()

    results: list[dict] = []
    for stock in stocks:
        # --- field conditions (AND) ---
        passed = True
        for cond in req.conditions:
            stock_val = stock.get(cond.field, 0.0)
            op_fn = _OPS[cond.operator]
            if not op_fn(float(stock_val), cond.value):
                passed = False
                break
        if not passed:
            continue

        # --- formula condition ---
        if req.formula and req.formula.strip():
            try:
                from data.formula_engine import evaluate_formula, FormulaError  # noqa: F401
                formula_result = evaluate_formula(req.formula.strip(), stock["_candles"])
                passes_formula = False
                if formula_result:
                    for series in formula_result:
                        data = series.get("data", [])
                        if data:
                            last_val = data[-1]["value"]
                            if (
                                last_val is not None
                                and last_val != 0
                                and not (isinstance(last_val, float) and math.isnan(last_val))
                            ):
                                passes_formula = True
                                break
                if not passes_formula:
                    continue
            except Exception:
                # If formula evaluation fails for this stock, skip it
                continue

        results.append(stock)

    # Sort
    results.sort(
        key=lambda s: (s.get(sort_by) or 0),
        reverse=req.sort_desc,
    )

    # Strip internal fields and apply limit
    clean: list[dict] = []
    for s in results[: req.limit]:
        clean.append({k: v for k, v in s.items() if not k.startswith("_")})

    return {
        "total": len(results),
        "stocks": clean,
        "fields": FIELDS,
    }
