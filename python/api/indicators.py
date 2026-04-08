"""
POST /api/indicators/calculate — compute technical indicators from raw candle data.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data.indicators_calc import calculate, ALL_INDICATORS

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


class IndicatorRequest(BaseModel):
    data: list[dict[str, Any]]
    indicator: str
    params: dict[str, Any] | None = None


@router.post("/calculate")
def calc_indicator(req: IndicatorRequest) -> dict:
    """
    Calculate a technical indicator from candle data.

    Request body:
    - data: list of candle dicts {time/date, open, high, low, close, volume}
    - indicator: one of MACD/DMA/DMI/TRIX/FSL/EMV/RSI/KDJ/WR/CCI/ROC/MTM/PSY/VOL/OBV/VR/ASI/BOLL/SAR/BRAR/CR/MOST
    - params: optional dict (reserved for future param overrides)

    Returns:
    - indicator: str
    - series: list of {name, type, data: [{time, value, color?}]}
    """
    if not req.data:
        raise HTTPException(status_code=400, detail="data cannot be empty")
    if req.indicator not in ALL_INDICATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown indicator '{req.indicator}'. Available: {ALL_INDICATORS}",
        )
    try:
        result = calculate(req.data, req.indicator, req.params)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


@router.get("/list")
def list_indicators() -> dict:
    """Return list of supported indicator names."""
    return {"indicators": ALL_INDICATORS}
