import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

DRAWING_TRENDLINE = {
    "id": "test-trendline-001",
    "type": "trendline",
    "points": [
        {"time": 1700000000.0, "price": 10.5},
        {"time": 1700086400.0, "price": 11.2},
    ],
    "style": {"color": "#FF4444", "lineWidth": 1, "lineStyle": "solid"},
    "text": None,
}

DRAWING_TEXT = {
    "id": "test-text-001",
    "type": "text",
    "points": [{"time": 1700172800.0, "price": 12.0}],
    "style": {"color": "#FFFFFF", "lineWidth": 1, "lineStyle": "solid"},
    "text": "Test label",
}

PARAMS = {"stock_code": "000001", "period": "daily"}


def _clear():
    client.delete("/api/drawings", params=PARAMS)


def test_drawings_crud_trendline():
    """Save a trendline drawing and retrieve it."""
    _clear()

    resp = client.put(
        f"/api/drawings/{DRAWING_TRENDLINE['id']}",
        params=PARAMS,
        json=DRAWING_TRENDLINE,
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp2 = client.get("/api/drawings", params=PARAMS)
    assert resp2.status_code == 200
    drawings = resp2.json()
    assert len(drawings) == 1
    d = drawings[0]
    assert d["id"] == DRAWING_TRENDLINE["id"]
    assert d["type"] == "trendline"
    assert len(d["points"]) == 2
    assert d["style"]["color"] == "#FF4444"


def test_drawings_multiple_tools():
    """Save drawings for multiple tool types and verify all persist."""
    _clear()

    tool_types = [
        ("trendline", [{"time": 1700000000.0, "price": 10.0}, {"time": 1700086400.0, "price": 11.0}]),
        ("ray", [{"time": 1700000000.0, "price": 10.0}, {"time": 1700086400.0, "price": 10.5}]),
        ("segment", [{"time": 1700000000.0, "price": 9.0}, {"time": 1700086400.0, "price": 9.5}]),
        ("horizontal", [{"time": 1700000000.0, "price": 10.0}]),
        ("vertical", [{"time": 1700000000.0, "price": 10.0}]),
        ("rectangle", [{"time": 1700000000.0, "price": 9.0}, {"time": 1700086400.0, "price": 11.0}]),
        ("fibRetracement", [{"time": 1700000000.0, "price": 8.0}, {"time": 1700086400.0, "price": 12.0}]),
        ("channel", [
            {"time": 1700000000.0, "price": 10.0},
            {"time": 1700086400.0, "price": 11.0},
            {"time": 1700043200.0, "price": 10.5},
        ]),
        ("gannAngle", [{"time": 1700000000.0, "price": 10.0}, {"time": 1700086400.0, "price": 11.0}]),
        ("buyMark", [{"time": 1700000000.0, "price": 9.8}]),
        ("sellMark", [{"time": 1700086400.0, "price": 11.0}]),
        ("flatMark", [{"time": 1700172800.0, "price": 10.2}]),
    ]

    style = {"color": "#FF4444", "lineWidth": 1, "lineStyle": "solid"}
    for i, (tool_type, points) in enumerate(tool_types):
        drawing = {
            "id": f"test-{tool_type}-{i:03d}",
            "type": tool_type,
            "points": points,
            "style": style,
            "text": None,
        }
        resp = client.put(f"/api/drawings/{drawing['id']}", params=PARAMS, json=drawing)
        assert resp.status_code == 200, f"Failed to save {tool_type}: {resp.text}"

    resp = client.get("/api/drawings", params=PARAMS)
    assert resp.status_code == 200
    drawings = resp.json()
    assert len(drawings) == len(tool_types), f"Expected {len(tool_types)}, got {len(drawings)}"

    saved_types = {d["type"] for d in drawings}
    for tool_type, _ in tool_types:
        assert tool_type in saved_types, f"{tool_type} not found in saved drawings"


def test_drawings_text_label():
    """Text drawing stores and retrieves text content."""
    _clear()

    resp = client.put(
        f"/api/drawings/{DRAWING_TEXT['id']}",
        params=PARAMS,
        json=DRAWING_TEXT,
    )
    assert resp.status_code == 200

    resp2 = client.get("/api/drawings", params=PARAMS)
    drawings = resp2.json()
    assert len(drawings) == 1
    assert drawings[0]["text"] == "Test label"


def test_drawings_delete_single():
    """Delete a single drawing by ID."""
    _clear()

    # Save two drawings
    for i in range(2):
        d = {
            "id": f"del-test-{i}",
            "type": "horizontal",
            "points": [{"time": 1700000000.0 + i * 86400, "price": 10.0 + i}],
            "style": {"color": "#FFFFFF", "lineWidth": 1, "lineStyle": "solid"},
            "text": None,
        }
        client.put(f"/api/drawings/{d['id']}", params=PARAMS, json=d)

    # Delete the first
    resp = client.delete("/api/drawings/del-test-0", params=PARAMS)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Only the second should remain
    resp2 = client.get("/api/drawings", params=PARAMS)
    drawings = resp2.json()
    assert len(drawings) == 1
    assert drawings[0]["id"] == "del-test-1"


def test_drawings_clear_all():
    """Clear all drawings for a stock/period."""
    _clear()

    for i in range(3):
        d = {
            "id": f"clear-test-{i}",
            "type": "vertical",
            "points": [{"time": 1700000000.0 + i * 86400, "price": 10.0}],
            "style": {"color": "#FFFFFF", "lineWidth": 1, "lineStyle": "solid"},
            "text": None,
        }
        client.put(f"/api/drawings/{d['id']}", params=PARAMS, json=d)

    resp = client.delete("/api/drawings", params=PARAMS)
    assert resp.status_code == 200

    resp2 = client.get("/api/drawings", params=PARAMS)
    assert resp2.json() == []


def test_drawings_isolated_by_period():
    """Drawings are scoped to stock_code + period — different period is isolated."""
    _clear()
    params_weekly = {"stock_code": "000001", "period": "weekly"}
    client.delete("/api/drawings", params=params_weekly)

    d = {
        "id": "period-test-001",
        "type": "horizontal",
        "points": [{"time": 1700000000.0, "price": 10.0}],
        "style": {"color": "#FFFFFF", "lineWidth": 1, "lineStyle": "solid"},
        "text": None,
    }
    client.put(f"/api/drawings/{d['id']}", params=PARAMS, json=d)

    # Weekly period should have no drawings
    resp = client.get("/api/drawings", params=params_weekly)
    assert resp.json() == []

    # Daily period should still have the drawing
    resp2 = client.get("/api/drawings", params=PARAMS)
    assert len(resp2.json()) == 1


def test_drawings_upsert():
    """Upserting with same ID updates the existing drawing."""
    _clear()

    d = {
        "id": "upsert-test-001",
        "type": "horizontal",
        "points": [{"time": 1700000000.0, "price": 10.0}],
        "style": {"color": "#FF0000", "lineWidth": 1, "lineStyle": "solid"},
        "text": None,
    }
    client.put(f"/api/drawings/{d['id']}", params=PARAMS, json=d)

    # Upsert with changed price
    d2 = dict(d)
    d2["points"] = [{"time": 1700000000.0, "price": 15.0}]
    d2["style"] = {"color": "#00FF00", "lineWidth": 2, "lineStyle": "dashed"}
    client.put(f"/api/drawings/{d2['id']}", params=PARAMS, json=d2)

    resp = client.get("/api/drawings", params=PARAMS)
    drawings = resp.json()
    assert len(drawings) == 1
    assert drawings[0]["points"][0]["price"] == 15.0
    assert drawings[0]["style"]["color"] == "#00FF00"
