from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from data.storage import (
    clear_drawings,
    delete_drawing,
    load_drawings,
    save_drawing,
)

router = APIRouter()


class DrawingPoint(BaseModel):
    time: float
    price: float


class DrawingStyle(BaseModel):
    color: str
    lineWidth: int
    lineStyle: str


class DrawingBody(BaseModel):
    id: str
    type: str
    points: list[dict[str, Any]]
    style: dict[str, Any]
    text: str | None = None


@router.get("/api/drawings")
def get_drawings(stock_code: str, period: str) -> list[dict]:
    return load_drawings(stock_code, period)


@router.put("/api/drawings/{drawing_id}")
def upsert_drawing(
    drawing_id: str,
    stock_code: str,
    period: str,
    body: DrawingBody,
) -> dict:
    drawing = body.model_dump()
    drawing["id"] = drawing_id
    save_drawing(stock_code, period, drawing)
    return {"ok": True}


@router.delete("/api/drawings/{drawing_id}")
def remove_drawing(drawing_id: str, stock_code: str, period: str) -> dict:
    delete_drawing(drawing_id, stock_code, period)
    return {"ok": True}


@router.delete("/api/drawings")
def remove_all_drawings(stock_code: str, period: str) -> dict:
    clear_drawings(stock_code, period)
    return {"ok": True}
