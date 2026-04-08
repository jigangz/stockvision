"""Tests for formula engine: parse, validate, evaluate."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure python package is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from data.formula_engine import parse_formula, evaluate_formula, FormulaError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_candles(n: int = 30) -> list[dict]:
    """Generate simple synthetic candles for testing."""
    candles = []
    price = 10.0
    for i in range(n):
        price += (0.1 if i % 3 != 0 else -0.05)
        candles.append({
            "time": 1700000000 + i * 86400,
            "open": round(price - 0.05, 2),
            "high": round(price + 0.1, 2),
            "low": round(price - 0.1, 2),
            "close": round(price, 2),
            "volume": 100000 + i * 1000,
            "amount": (100000 + i * 1000) * price,
        })
    return candles


CANDLES = make_candles(50)


# ---------------------------------------------------------------------------
# parse_formula tests
# ---------------------------------------------------------------------------

class TestParseFormula:
    def test_valid_simple_expression(self):
        valid, err = parse_formula("CLOSE")
        assert valid
        assert err == ""

    def test_valid_assignment(self):
        valid, err = parse_formula("MA5 := MA(CLOSE, 5)")
        assert valid
        assert err == ""

    def test_valid_multi_line(self):
        formula = "DIF := EMA(CLOSE, 12) - EMA(CLOSE, 26)\nDEA := EMA(DIF, 9)"
        valid, err = parse_formula(formula)
        assert valid
        assert err == ""

    def test_invalid_syntax_missing_paren(self):
        valid, err = parse_formula("MA(CLOSE, 5")
        assert not valid
        assert err != ""

    def test_invalid_syntax_unknown_op(self):
        valid, err = parse_formula("CLOSE $$ 2")
        assert not valid

    def test_valid_comment(self):
        valid, err = parse_formula("{this is a comment}\nMA5 := MA(CLOSE, 5)")
        assert valid
        assert err == ""

    def test_valid_all_variables(self):
        formula = "X := OPEN + HIGH + LOW + CLOSE + VOL + AMOUNT"
        valid, err = parse_formula(formula)
        assert valid

    def test_valid_comparison(self):
        valid, err = parse_formula("CLOSE > MA(CLOSE, 5)")
        assert valid

    def test_valid_logical(self):
        valid, err = parse_formula("CLOSE > OPEN AND VOL > 100000")
        assert valid


# ---------------------------------------------------------------------------
# evaluate_formula tests
# ---------------------------------------------------------------------------

class TestEvaluateFormula:
    def test_bare_close_returns_close_values(self):
        results = evaluate_formula("CLOSE", CANDLES)
        assert len(results) == 1
        assert results[0]["name"] == "result"
        assert len(results[0]["data"]) == len(CANDLES)
        # First value should match CANDLES[0]["close"]
        assert abs(results[0]["data"][0]["value"] - CANDLES[0]["close"]) < 1e-4

    def test_ma_assignment(self):
        results = evaluate_formula("MA5 := MA(CLOSE, 5)", CANDLES)
        assert len(results) == 1
        assert results[0]["name"] == "MA5"
        # First 4 bars should be NaN (not in data), bar 5+ should have values
        assert len(results[0]["data"]) == len(CANDLES) - 4

    def test_ma_value_correctness(self):
        closes = np.array([c["close"] for c in CANDLES])
        results = evaluate_formula("MA5 := MA(CLOSE, 5)", CANDLES)
        data = results[0]["data"]
        # Last value: average of last 5 closes
        expected = float(np.mean(closes[-5:]))
        actual = data[-1]["value"]
        assert abs(actual - expected) < 1e-4

    def test_ema_assignment(self):
        results = evaluate_formula("EMA12 := EMA(CLOSE, 12)", CANDLES)
        assert len(results) == 1
        assert results[0]["name"] == "EMA12"
        assert len(results[0]["data"]) > 0

    def test_multi_line_formula(self):
        formula = "DIF := EMA(CLOSE, 12) - EMA(CLOSE, 26)\nDEA := EMA(DIF, 9)"
        results = evaluate_formula(formula, CANDLES)
        assert len(results) == 2
        names = [r["name"] for r in results]
        assert "DIF" in names
        assert "DEA" in names

    def test_ref_function(self):
        results = evaluate_formula("PREV := REF(CLOSE, 1)", CANDLES)
        assert results[0]["name"] == "PREV"
        # Value at index 1 should equal close at index 0
        data = results[0]["data"]
        assert abs(data[0]["value"] - CANDLES[0]["close"]) < 1e-4

    def test_hhv_llv(self):
        results_hhv = evaluate_formula("H5 := HHV(HIGH, 5)", CANDLES)
        results_llv = evaluate_formula("L5 := LLV(LOW, 5)", CANDLES)
        assert len(results_hhv[0]["data"]) > 0
        assert len(results_llv[0]["data"]) > 0
        # HHV >= LLV always
        for h, l in zip(results_hhv[0]["data"], results_llv[0]["data"]):
            assert h["value"] >= l["value"]

    def test_sum_function(self):
        results = evaluate_formula("S5 := SUM(VOL, 5)", CANDLES)
        vols = np.array([c["volume"] for c in CANDLES])
        data = results[0]["data"]
        # Last value = sum of last 5 volumes
        expected = float(np.sum(vols[-5:]))
        assert abs(data[-1]["value"] - expected) < 1

    def test_cross_function(self):
        formula = "C := CROSS(MA(CLOSE, 5), MA(CLOSE, 10))"
        results = evaluate_formula(formula, CANDLES)
        assert results[0]["name"] == "C"
        # Values should be 0 or 1
        for item in results[0]["data"]:
            assert item["value"] in (0.0, 1.0)

    def test_count_function(self):
        formula = "UP := COUNT(CLOSE > OPEN, 5)"
        results = evaluate_formula(formula, CANDLES)
        assert results[0]["name"] == "UP"
        # Count should be between 0 and 5
        for item in results[0]["data"]:
            assert 0 <= item["value"] <= 5

    def test_barslast_function(self):
        formula = "BL := BARSLAST(CLOSE > MA(CLOSE, 5))"
        results = evaluate_formula(formula, CANDLES)
        assert results[0]["name"] == "BL"
        assert len(results[0]["data"]) > 0

    def test_sma_function(self):
        formula = "S := SMA(CLOSE, 12, 1)"
        results = evaluate_formula(formula, CANDLES)
        assert len(results[0]["data"]) == len(CANDLES)

    def test_arithmetic_operators(self):
        formula = "MID := (HIGH + LOW) / 2"
        results = evaluate_formula(formula, CANDLES)
        assert results[0]["name"] == "MID"
        # Spot check
        data = results[0]["data"]
        candle = CANDLES[0]
        expected = (candle["high"] + candle["low"]) / 2
        assert abs(data[0]["value"] - expected) < 1e-4

    def test_comparison_operator(self):
        formula = "UP := CLOSE > OPEN"
        results = evaluate_formula(formula, CANDLES)
        for item in results[0]["data"]:
            assert item["value"] in (0.0, 1.0)

    def test_logical_and(self):
        formula = "COND := CLOSE > OPEN AND VOL > 100000"
        results = evaluate_formula(formula, CANDLES)
        for item in results[0]["data"]:
            assert item["value"] in (0.0, 1.0)

    def test_empty_data_raises(self):
        with pytest.raises(FormulaError):
            evaluate_formula("CLOSE", [])

    def test_unknown_variable_raises(self):
        with pytest.raises(FormulaError):
            evaluate_formula("FOOBAR", CANDLES)

    def test_unknown_function_raises(self):
        with pytest.raises(FormulaError):
            evaluate_formula("X := UNKNOWNFUNC(CLOSE, 5)", CANDLES)

    def test_nan_values_excluded(self):
        """NaN values should not appear in output data."""
        results = evaluate_formula("MA5 := MA(CLOSE, 5)", CANDLES)
        for item in results[0]["data"]:
            assert not math.isnan(item["value"])


# ---------------------------------------------------------------------------
# API endpoint tests (via FastAPI TestClient)
# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app
    return TestClient(app)


class TestFormulaAPI:
    def test_validate_valid_formula(self, client):
        resp = client.post("/api/formula/validate", json={"formula": "MA5 := MA(CLOSE, 5)"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert data["error"] == ""

    def test_validate_invalid_formula(self, client):
        resp = client.post("/api/formula/validate", json={"formula": "MA(CLOSE"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is False
        assert data["error"] != ""

    def test_evaluate_returns_series(self, client):
        resp = client.post("/api/formula/evaluate", json={
            "formula": "MA5 := MA(CLOSE, 5)",
            "data": CANDLES,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "series" in data
        assert len(data["series"]) == 1
        assert data["series"][0]["name"] == "MA5"
        assert len(data["series"][0]["data"]) > 0

    def test_evaluate_multi_output(self, client):
        formula = "DIF := EMA(CLOSE, 12) - EMA(CLOSE, 26)\nDEA := EMA(DIF, 9)"
        resp = client.post("/api/formula/evaluate", json={
            "formula": formula,
            "data": CANDLES,
        })
        assert resp.status_code == 200
        series = resp.json()["series"]
        assert len(series) == 2

    def test_evaluate_empty_data_returns_400(self, client):
        resp = client.post("/api/formula/evaluate", json={
            "formula": "MA5 := MA(CLOSE, 5)",
            "data": [],
        })
        assert resp.status_code == 400

    def test_evaluate_invalid_syntax_returns_400(self, client):
        resp = client.post("/api/formula/evaluate", json={
            "formula": "MA(CLOSE",
            "data": CANDLES,
        })
        assert resp.status_code == 400

    def test_evaluate_all_builtin_functions(self, client):
        formulas = [
            "R := MA(CLOSE, 5)",
            "R := EMA(CLOSE, 12)",
            "R := SMA(CLOSE, 12, 1)",
            "R := REF(CLOSE, 1)",
            "R := REFX(CLOSE, 1)",
            "R := CROSS(MA(CLOSE,5), MA(CLOSE,10))",
            "R := HHV(HIGH, 5)",
            "R := LLV(LOW, 5)",
            "R := COUNT(CLOSE > OPEN, 5)",
            "R := BARSLAST(CLOSE > OPEN)",
            "R := SUM(VOL, 5)",
        ]
        for formula in formulas:
            resp = client.post("/api/formula/evaluate", json={
                "formula": formula,
                "data": CANDLES,
            })
            assert resp.status_code == 200, f"Failed for formula: {formula}"
            assert len(resp.json()["series"]) == 1
