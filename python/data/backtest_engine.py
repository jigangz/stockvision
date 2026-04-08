"""
Backtest engine for formula-based buy/sell strategies.

BacktestEngine accepts candle data + buy/sell formulas, simulates trades,
and returns performance metrics and equity curve.
"""
from __future__ import annotations

import math
from typing import Any


def _evaluate_signal(formula: str, candles: list[dict]) -> list[float]:
    """Evaluate a formula against candle data, return list of signal values (one per bar)."""
    from data.formula_engine import evaluate_formula

    results = evaluate_formula(formula.strip(), candles)
    if not results:
        return [0.0] * len(candles)

    # Use first output series
    data = results[0].get("data", [])
    values: list[float] = []
    for item in data:
        v = item.get("value")
        if v is None or (isinstance(v, float) and math.isnan(v)):
            values.append(0.0)
        else:
            values.append(float(v))

    # Pad to length if needed
    while len(values) < len(candles):
        values.insert(0, 0.0)

    return values[-len(candles):]


class BacktestEngine:
    """
    Simple long-only backtest engine.

    Strategy:
    - Buy at close when buy_formula signal > 0 (not already in position)
    - Sell at close when sell_formula signal > 0 (while in position)
    - One full position at a time (100% of capital)
    - No transaction costs by default
    """

    def __init__(
        self,
        candles: list[dict],
        buy_formula: str,
        sell_formula: str,
        initial_capital: float = 100_000.0,
        commission_rate: float = 0.0,
    ) -> None:
        self.candles = candles
        self.buy_formula = buy_formula
        self.sell_formula = sell_formula
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate

    def run(self) -> dict[str, Any]:
        """Run the backtest and return results dict."""
        if len(self.candles) < 2:
            return self._empty_result()

        # Evaluate buy/sell signals
        buy_signals = _evaluate_signal(self.buy_formula, self.candles)
        sell_signals = _evaluate_signal(self.sell_formula, self.candles)

        capital = self.initial_capital
        in_position = False
        entry_price = 0.0
        entry_idx = 0
        entry_date = ""

        trades: list[dict] = []
        equity_curve: list[dict] = []  # [{date, equity}]

        # Mark-to-market equity at each bar
        for i, candle in enumerate(self.candles):
            close = float(candle.get("close", candle.get("c", 0)))
            date = str(candle.get("date", candle.get("time", i)))

            if in_position:
                current_equity = capital * (close / entry_price)
            else:
                current_equity = capital

            equity_curve.append({"date": date, "equity": round(current_equity, 2)})

            # Only trade on bar close — skip last bar (no exit opportunity after last buy)
            buy_sig = buy_signals[i] if i < len(buy_signals) else 0.0
            sell_sig = sell_signals[i] if i < len(sell_signals) else 0.0

            if not in_position and buy_sig > 0:
                # Enter long
                commission = capital * self.commission_rate
                capital -= commission
                in_position = True
                entry_price = close
                entry_idx = i
                entry_date = date

            elif in_position and sell_sig > 0 and i > entry_idx:
                # Exit long
                exit_price = close
                pnl_pct = (exit_price - entry_price) / entry_price
                commission = capital * (1 + pnl_pct) * self.commission_rate
                capital = capital * (1 + pnl_pct) - commission

                trades.append({
                    "entry_date": entry_date,
                    "exit_date": date,
                    "entry_price": round(entry_price, 4),
                    "exit_price": round(exit_price, 4),
                    "pnl_pct": round(pnl_pct * 100, 4),
                    "hold_bars": i - entry_idx,
                    "direction": "long",
                })
                in_position = False

        # If still in position at end, mark open (no closing trade recorded)
        # Recalculate final equity from closed trades only
        final_equity = capital
        if in_position:
            last_close = float(self.candles[-1].get("close", self.candles[-1].get("c", entry_price)))
            final_equity = capital * (last_close / entry_price)

        # --- Metrics ---
        total_return = (final_equity - self.initial_capital) / self.initial_capital * 100

        # Max drawdown from equity curve
        max_drawdown = self._max_drawdown([e["equity"] for e in equity_curve])

        # Trade metrics
        if trades:
            wins = [t for t in trades if t["pnl_pct"] > 0]
            losses = [t for t in trades if t["pnl_pct"] <= 0]
            win_rate = len(wins) / len(trades) * 100
            gross_profit = sum(t["pnl_pct"] for t in wins)
            gross_loss = abs(sum(t["pnl_pct"] for t in losses))
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
            avg_hold_days = sum(t["hold_bars"] for t in trades) / len(trades)
        else:
            win_rate = 0.0
            profit_factor = 0.0
            avg_hold_days = 0.0

        # Sharpe ratio (annualized, using daily equity returns)
        sharpe = self._sharpe_ratio([e["equity"] for e in equity_curve])

        return {
            "totalReturn": round(total_return, 4),
            "maxDrawdown": round(max_drawdown, 4),
            "winRate": round(win_rate, 4),
            "profitFactor": round(profit_factor, 4) if math.isfinite(profit_factor) else 999.0,
            "sharpe": round(sharpe, 4),
            "tradeCount": len(trades),
            "avgHoldDays": round(avg_hold_days, 2),
            "initialCapital": self.initial_capital,
            "finalEquity": round(final_equity, 2),
            "equityCurve": equity_curve,
            "trades": trades,
        }

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    def _max_drawdown(self, equity: list[float]) -> float:
        """Return maximum percentage drawdown (positive number, e.g. 15.3 for 15.3% drawdown)."""
        if len(equity) < 2:
            return 0.0
        peak = equity[0]
        max_dd = 0.0
        for e in equity:
            if e > peak:
                peak = e
            if peak > 0:
                dd = (peak - e) / peak * 100
                if dd > max_dd:
                    max_dd = dd
        return max_dd

    def _sharpe_ratio(self, equity: list[float], periods_per_year: int = 252) -> float:
        """Annualized Sharpe ratio (risk-free rate = 0)."""
        if len(equity) < 2:
            return 0.0
        returns = [
            (equity[i] - equity[i - 1]) / equity[i - 1]
            for i in range(1, len(equity))
            if equity[i - 1] > 0
        ]
        if not returns:
            return 0.0
        n = len(returns)
        mean_r = sum(returns) / n
        if n < 2:
            return 0.0
        variance = sum((r - mean_r) ** 2 for r in returns) / (n - 1)
        std_r = math.sqrt(variance)
        if std_r == 0:
            return 0.0
        return mean_r / std_r * math.sqrt(periods_per_year)

    def _empty_result(self) -> dict[str, Any]:
        return {
            "totalReturn": 0.0,
            "maxDrawdown": 0.0,
            "winRate": 0.0,
            "profitFactor": 0.0,
            "sharpe": 0.0,
            "tradeCount": 0,
            "avgHoldDays": 0.0,
            "initialCapital": self.initial_capital,
            "finalEquity": self.initial_capital,
            "equityCurve": [],
            "trades": [],
        }
