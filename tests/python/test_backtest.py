"""
Tests for the backtest engine and POST /api/backtest/run endpoint.
"""
import math
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure python package root is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))


# ─────────────────────────────────────────────────
# BacktestEngine unit tests
# ─────────────────────────────────────────────────

def _make_candles(prices: list[float]) -> list[dict]:
    """Create minimal candle dicts from a list of close prices."""
    from datetime import date, timedelta
    start = date(2024, 1, 2)
    candles = []
    for i, price in enumerate(prices):
        d = start + timedelta(days=i)
        candles.append({
            "date": d.isoformat(),
            "open": price * 0.99,
            "high": price * 1.01,
            "low": price * 0.98,
            "close": price,
            "volume": 1_000_000.0,
            "amount": price * 1_000_000.0,
        })
    return candles


def test_engine_empty_result():
    """Single candle → empty result, no trades."""
    from data.backtest_engine import BacktestEngine
    engine = BacktestEngine(
        candles=_make_candles([10.0]),
        buy_formula="CLOSE > 0",
        sell_formula="CLOSE < 0",
    )
    result = engine.run()
    assert result["tradeCount"] == 0
    assert result["totalReturn"] == 0.0


def test_engine_no_trades_when_no_signal():
    """If buy signal never fires, no trades and equity = initial capital."""
    from data.backtest_engine import BacktestEngine
    prices = [10.0] * 20
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CLOSE < 0",   # never true
        sell_formula="CLOSE > 0",
    )
    result = engine.run()
    assert result["tradeCount"] == 0
    assert result["totalReturn"] == 0.0
    assert result["finalEquity"] == 100_000.0


def test_engine_single_trade_profit():
    """Buy at 10, sell at 15 → +50% return."""
    from data.backtest_engine import BacktestEngine
    # 5 bars at 10, then 5 bars rising to 15
    prices = [10.0, 10.0, 10.0, 15.0, 15.0]
    # Buy when close==10, sell when close==15
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CLOSE == 10",
        sell_formula="CLOSE == 15",
    )
    result = engine.run()
    assert result["tradeCount"] >= 1
    # At least one trade with profit
    wins = [t for t in result["trades"] if t["pnl_pct"] > 0]
    assert len(wins) >= 1


def test_engine_returns_required_fields():
    """Result must contain all required output fields."""
    from data.backtest_engine import BacktestEngine
    prices = [10.0 + i * 0.1 for i in range(30)]
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="MA(CLOSE,5) > MA(CLOSE,10)",
        sell_formula="MA(CLOSE,5) < MA(CLOSE,10)",
    )
    result = engine.run()
    required = [
        "totalReturn", "maxDrawdown", "winRate", "profitFactor",
        "sharpe", "tradeCount", "avgHoldDays",
        "initialCapital", "finalEquity", "equityCurve", "trades",
    ]
    for field in required:
        assert field in result, f"Missing field: {field}"


def test_engine_equity_curve_length():
    """Equity curve has one entry per candle bar."""
    from data.backtest_engine import BacktestEngine
    prices = [10.0 + i * 0.05 for i in range(50)]
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CLOSE > REF(CLOSE,1)",
        sell_formula="CLOSE < REF(CLOSE,1)",
    )
    result = engine.run()
    assert len(result["equityCurve"]) == len(prices)


def test_engine_max_drawdown_positive():
    """MaxDrawdown should be >= 0."""
    from data.backtest_engine import BacktestEngine
    prices = [10.0, 12.0, 8.0, 11.0, 9.0, 13.0]
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CLOSE > 0",
        sell_formula="CLOSE < 0",
    )
    result = engine.run()
    assert result["maxDrawdown"] >= 0.0


def test_engine_win_rate_bounds():
    """Win rate must be between 0 and 100."""
    from data.backtest_engine import BacktestEngine
    prices = list(range(10, 40))
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CROSS(CLOSE, MA(CLOSE,5))",
        sell_formula="CROSS(MA(CLOSE,5), CLOSE)",
    )
    result = engine.run()
    assert 0.0 <= result["winRate"] <= 100.0


def test_engine_trade_fields():
    """Each trade dict must have required fields."""
    from data.backtest_engine import BacktestEngine
    prices = [10.0, 11.0, 12.0, 11.0, 10.0, 9.0, 10.0, 11.0]
    engine = BacktestEngine(
        candles=_make_candles(prices),
        buy_formula="CLOSE > REF(CLOSE,1)",
        sell_formula="CLOSE < REF(CLOSE,1)",
    )
    result = engine.run()
    for trade in result["trades"]:
        assert "entry_date" in trade
        assert "exit_date" in trade
        assert "entry_price" in trade
        assert "exit_price" in trade
        assert "pnl_pct" in trade
        assert "hold_bars" in trade
        assert trade["hold_bars"] >= 1


def test_engine_profit_factor_zero_trades():
    """No trades → profitFactor = 0."""
    from data.backtest_engine import BacktestEngine
    engine = BacktestEngine(
        candles=_make_candles([10.0] * 10),
        buy_formula="CLOSE < 0",
        sell_formula="CLOSE < 0",
    )
    result = engine.run()
    assert result["profitFactor"] == 0.0


def test_engine_initial_capital_respected():
    """Initial capital is reflected in finalEquity when no trades."""
    from data.backtest_engine import BacktestEngine
    engine = BacktestEngine(
        candles=_make_candles([10.0] * 5),
        buy_formula="CLOSE < 0",
        sell_formula="CLOSE > 0",
        initial_capital=50_000.0,
    )
    result = engine.run()
    assert result["initialCapital"] == 50_000.0
    assert result["finalEquity"] == 50_000.0


# ─────────────────────────────────────────────────
# API endpoint tests
# ─────────────────────────────────────────────────

@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_backtest_run_basic(client):
    """POST /api/backtest/run returns 200 with valid request."""
    resp = client.post("/api/backtest/run", json={
        "code": "000001",
        "market": "SZ",
        "period": "daily",
        "buy_formula": "MA(CLOSE,5) > MA(CLOSE,10)",
        "sell_formula": "MA(CLOSE,5) < MA(CLOSE,10)",
        "initial_capital": 100000.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "totalReturn" in data
    assert "tradeCount" in data
    assert "equityCurve" in data
    assert "trades" in data


def test_backtest_run_required_metrics(client):
    """All 7 required metrics present in response."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "CLOSE > REF(CLOSE,1)",
        "sell_formula": "CLOSE < REF(CLOSE,1)",
    })
    assert resp.status_code == 200
    data = resp.json()
    for field in ["totalReturn", "maxDrawdown", "winRate", "profitFactor", "sharpe", "tradeCount", "avgHoldDays"]:
        assert field in data, f"Missing metric: {field}"


def test_backtest_run_missing_buy_formula(client):
    """Empty buy_formula returns 400."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "",
        "sell_formula": "CLOSE < MA(CLOSE,5)",
    })
    assert resp.status_code == 400


def test_backtest_run_missing_sell_formula(client):
    """Empty sell_formula returns 400."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "CLOSE > MA(CLOSE,5)",
        "sell_formula": "",
    })
    assert resp.status_code == 400


def test_backtest_run_equity_curve_not_empty(client):
    """Equity curve has entries when there's data."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "CLOSE > 0",
        "sell_formula": "CLOSE < 0",
        "start": "2024-01-01",
        "end": "2024-06-30",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["equityCurve"]) > 0
    assert data["barCount"] == len(data["equityCurve"])


def test_backtest_run_trade_records(client):
    """Trade records list present and properly structured."""
    resp = client.post("/api/backtest/run", json={
        "code": "000001",
        "market": "SZ",
        "buy_formula": "CROSS(MA(CLOSE,5), MA(CLOSE,10))",
        "sell_formula": "CROSS(MA(CLOSE,10), MA(CLOSE,5))",
        "start": "2023-01-01",
        "end": "2024-12-31",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["trades"], list)
    assert data["tradeCount"] == len(data["trades"])


def test_backtest_run_different_stocks(client):
    """Backtest can run on different stock codes."""
    for code, market in [("600519", "SH"), ("000002", "SZ")]:
        resp = client.post("/api/backtest/run", json={
            "code": code,
            "market": market,
            "buy_formula": "CLOSE > MA(CLOSE,20)",
            "sell_formula": "CLOSE < MA(CLOSE,20)",
        })
        assert resp.status_code == 200, f"Failed for {code}"


def test_backtest_run_sharpe_is_finite(client):
    """Sharpe ratio must be a finite number."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "CLOSE > MA(CLOSE,5)",
        "sell_formula": "CLOSE < MA(CLOSE,5)",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert math.isfinite(data["sharpe"])


def test_backtest_run_max_drawdown_non_negative(client):
    """maxDrawdown is always >= 0."""
    resp = client.post("/api/backtest/run", json={
        "buy_formula": "CLOSE > 0",
        "sell_formula": "CLOSE < 0",
    })
    assert resp.status_code == 200
    assert resp.json()["maxDrawdown"] >= 0.0


def test_backtest_run_code_in_response(client):
    """Response echoes back the requested code and market."""
    resp = client.post("/api/backtest/run", json={
        "code": "600519",
        "market": "SH",
        "buy_formula": "CLOSE > MA(CLOSE,5)",
        "sell_formula": "CLOSE < MA(CLOSE,5)",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "600519"
    assert data["market"] == "SH"
