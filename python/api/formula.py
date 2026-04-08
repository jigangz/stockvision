"""
Formula engine API endpoints.

POST /api/formula/validate — parse only, return errors
POST /api/formula/evaluate — parse + evaluate, return series data
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data.formula_engine import parse_formula, evaluate_formula, FormulaError

router = APIRouter(prefix="/api/formula", tags=["formula"])


class ValidateRequest(BaseModel):
    formula: str


class EvaluateRequest(BaseModel):
    formula: str
    data: list[dict[str, Any]]


@router.post("/validate")
def validate_formula(req: ValidateRequest) -> dict:
    """
    Validate formula syntax without evaluating.

    Returns:
    - valid: bool
    - error: str (empty when valid)
    """
    valid, error = parse_formula(req.formula)
    return {"valid": valid, "error": error}


@router.post("/evaluate")
def evaluate(req: EvaluateRequest) -> dict:
    """
    Evaluate a formula against candle data.

    Returns:
    - series: list of {name, data: [{time, value}]}
    """
    if not req.data:
        raise HTTPException(status_code=400, detail="data cannot be empty")

    valid, error = parse_formula(req.formula)
    if not valid:
        raise HTTPException(status_code=400, detail=f"Formula syntax error: {error}")

    try:
        series = evaluate_formula(req.formula, req.data)
    except FormulaError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"series": series}
