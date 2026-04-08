"""
通达信-compatible formula engine using lark LALR parser.

Supports:
  Variables: OPEN HIGH LOW CLOSE VOL AMOUNT
  Functions: MA EMA SMA REF REFX CROSS LONGCROSS HHV LLV COUNT BARSLAST SUM
  Operators: + - * / > < >= <= == != AND OR NOT ( )
  Assignment: NAME := expr   (output line)
  Comments:   {this is a comment}
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from lark import Lark, Transformer, Token, UnexpectedInput
from lark.exceptions import VisitError

# ---------------------------------------------------------------------------
# Grammar (LALR)
# ---------------------------------------------------------------------------

GRAMMAR = r"""
    start: _SEP* statement (_SEP+ statement)* _SEP*

    _SEP: /[\r\n]+/

    statement: NAME ":=" expr   -> assign
             | expr             -> expr_stmt

    expr: expr "OR"i  and_expr  -> or_op
        | and_expr

    and_expr: and_expr "AND"i not_expr -> and_op
            | not_expr

    not_expr: "NOT"i not_expr   -> not_op
            | cmp_expr

    cmp_expr: cmp_expr ">=" add_expr  -> cmp_gte
            | cmp_expr "<=" add_expr  -> cmp_lte
            | cmp_expr "==" add_expr  -> cmp_eq
            | cmp_expr "!=" add_expr  -> cmp_ne
            | cmp_expr ">"  add_expr  -> cmp_gt
            | cmp_expr "<"  add_expr  -> cmp_lt
            | add_expr

    add_expr: add_expr "+" mul_expr  -> add
            | add_expr "-" mul_expr  -> sub
            | mul_expr

    mul_expr: mul_expr "*" unary     -> mul
            | mul_expr "/" unary     -> div
            | unary

    unary: "-" atom  -> neg
         | atom

    atom: NAME "(" arglist ")"  -> func_call
        | NAME                  -> var_ref
        | NUMBER                -> number
        | "(" expr ")"          -> paren

    arglist: expr ("," expr)*   -> arglist

    NAME: /[A-Za-z_][A-Za-z0-9_]*/
    NUMBER: /[0-9]+(\.[0-9]+)?/

    %ignore /[ \t]+/
    %ignore /\{[^}]*\}/
"""

_parser = Lark(GRAMMAR, parser="lalr")


# ---------------------------------------------------------------------------
# Evaluator
# ---------------------------------------------------------------------------

class FormulaError(Exception):
    pass


def _to_arr(v: Any, n: int) -> np.ndarray:
    if isinstance(v, np.ndarray):
        return v.astype(float)
    return np.full(n, float(v))


class FormulaEvaluator(Transformer):

    def __init__(self, ctx: dict[str, np.ndarray], n: int):
        super().__init__()
        self._ctx = {k.upper(): v for k, v in ctx.items()}
        self._n = n
        self._outputs: list[dict] = []

    def _arr(self, v: Any) -> np.ndarray:
        return _to_arr(v, self._n)

    # ---- top-level --------------------------------------------------------

    def start(self, _items):
        return self._outputs

    def assign(self, items):
        name = str(items[0])
        val = self._arr(items[1])
        self._ctx[name.upper()] = val
        self._outputs.append({"name": name, "values": val})

    def expr_stmt(self, items):
        val = self._arr(items[0])
        idx = sum(1 for o in self._outputs if o["name"].startswith("result"))
        name = "result" if idx == 0 else f"result{idx}"
        self._outputs.append({"name": name, "values": val})

    # ---- logical ----------------------------------------------------------

    def or_op(self, items):
        a, b = self._arr(items[0]), self._arr(items[1])
        return ((a != 0) | (b != 0)).astype(float)

    def and_op(self, items):
        a, b = self._arr(items[0]), self._arr(items[1])
        return ((a != 0) & (b != 0)).astype(float)

    def not_op(self, items):
        return (self._arr(items[0]) == 0).astype(float)

    # ---- comparison -------------------------------------------------------

    def cmp_gt(self, items):
        return (self._arr(items[0]) > self._arr(items[1])).astype(float)

    def cmp_lt(self, items):
        return (self._arr(items[0]) < self._arr(items[1])).astype(float)

    def cmp_gte(self, items):
        return (self._arr(items[0]) >= self._arr(items[1])).astype(float)

    def cmp_lte(self, items):
        return (self._arr(items[0]) <= self._arr(items[1])).astype(float)

    def cmp_eq(self, items):
        return (self._arr(items[0]) == self._arr(items[1])).astype(float)

    def cmp_ne(self, items):
        return (self._arr(items[0]) != self._arr(items[1])).astype(float)

    # ---- arithmetic -------------------------------------------------------

    def add(self, items):
        return self._arr(items[0]) + self._arr(items[1])

    def sub(self, items):
        return self._arr(items[0]) - self._arr(items[1])

    def mul(self, items):
        return self._arr(items[0]) * self._arr(items[1])

    def div(self, items):
        a, b = self._arr(items[0]), self._arr(items[1])
        with np.errstate(divide="ignore", invalid="ignore"):
            return np.where(b == 0, np.nan, a / b)

    def neg(self, items):
        return -self._arr(items[0])

    def paren(self, items):
        return items[0]

    # ---- atoms ------------------------------------------------------------

    def var_ref(self, items):
        name = str(items[0]).upper()
        if name not in self._ctx:
            raise FormulaError(f"Unknown variable '{name}'")
        return self._ctx[name]

    def number(self, items):
        return float(items[0])

    # ---- functions --------------------------------------------------------

    def arglist(self, items):
        return items

    def func_call(self, items):
        name = str(items[0]).upper()
        args = items[1]  # list from arglist
        n = self._n

        def arr(v):
            return _to_arr(v, n)

        def iarg(i: int) -> int:
            return int(round(float(arr(args[i])[0])))

        if name == "MA":
            return _ma(arr(args[0]), iarg(1))

        elif name == "EMA":
            return _ema(arr(args[0]), iarg(1))

        elif name == "SMA":
            m = iarg(2) if len(args) > 2 else 1
            return _sma(arr(args[0]), iarg(1), m)

        elif name == "REF":
            return _ref(arr(args[0]), iarg(1))

        elif name == "REFX":
            src, shift = arr(args[0]), iarg(1)
            out = np.full(n, np.nan)
            if 0 < shift < n:
                out[:-shift] = src[shift:]
            return out

        elif name == "CROSS":
            a, b = arr(args[0]), arr(args[1])
            prev_a, prev_b = np.roll(a, 1), np.roll(b, 1)
            return ((prev_a <= prev_b) & (a > b)).astype(float)

        elif name == "LONGCROSS":
            a, b = arr(args[0]), arr(args[1])
            n_bars = iarg(2)
            cross = ((np.roll(a, 1) <= np.roll(b, 1)) & (a > b)).astype(float)
            return (_sum_window(cross, n_bars) >= n_bars).astype(float)

        elif name == "HHV":
            return _rolling_max(arr(args[0]), iarg(1))

        elif name == "LLV":
            return _rolling_min(arr(args[0]), iarg(1))

        elif name == "COUNT":
            cond = (arr(args[0]) != 0).astype(float)
            return _sum_window(cond, iarg(1))

        elif name == "BARSLAST":
            cond = arr(args[0])
            out = np.full(n, np.nan)
            last = -1
            for i in range(n):
                if cond[i] != 0:
                    last = i
                if last >= 0:
                    out[i] = i - last
            return out

        elif name == "SUM":
            period = iarg(1)
            if period == 0:
                return np.cumsum(arr(args[0]))
            return _sum_window(arr(args[0]), period)

        else:
            raise FormulaError(f"Unknown function '{name}'")

    # ---- pass-throughs: single-child rules become transparent -------------
    def expr(self, items):
        return items[0]

    def and_expr(self, items):
        return items[0]

    def not_expr(self, items):
        return items[0]

    def cmp_expr(self, items):
        return items[0]

    def add_expr(self, items):
        return items[0]

    def mul_expr(self, items):
        return items[0]

    def unary(self, items):
        return items[0]

    def atom(self, items):
        return items[0]


# ---------------------------------------------------------------------------
# Rolling helpers
# ---------------------------------------------------------------------------

def _ma(src: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(src), np.nan)
    for i in range(period - 1, len(src)):
        out[i] = np.mean(src[i - period + 1: i + 1])
    return out


def _ema(src: np.ndarray, period: int) -> np.ndarray:
    k = 2 / (period + 1)
    out = np.full(len(src), np.nan)
    if len(src) < period:
        return out
    out[period - 1] = np.mean(src[:period])
    for i in range(period, len(src)):
        out[i] = src[i] * k + out[i - 1] * (1 - k)
    return out


def _sma(src: np.ndarray, period: int, m: int) -> np.ndarray:
    """Chinese SMA: SMA[i] = (M * src[i] + (N-M) * SMA[i-1]) / N"""
    out = np.full(len(src), np.nan)
    if len(src) == 0:
        return out
    out[0] = src[0]
    for i in range(1, len(src)):
        prev = out[i - 1] if not math.isnan(out[i - 1]) else src[i]
        out[i] = (m * src[i] + (period - m) * prev) / period
    return out


def _ref(src: np.ndarray, shift: int) -> np.ndarray:
    out = np.full(len(src), np.nan)
    if shift > 0 and shift < len(src):
        out[shift:] = src[:-shift]
    elif shift == 0:
        out[:] = src
    return out


def _rolling_max(src: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(src), np.nan)
    for i in range(period - 1, len(src)):
        out[i] = np.max(src[i - period + 1: i + 1])
    return out


def _rolling_min(src: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(src), np.nan)
    for i in range(period - 1, len(src)):
        out[i] = np.min(src[i - period + 1: i + 1])
    return out


def _sum_window(src: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(src), np.nan)
    for i in range(period - 1, len(src)):
        out[i] = np.sum(src[i - period + 1: i + 1])
    return out


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_formula(formula: str) -> tuple[bool, str]:
    """Returns (is_valid, error_message). Empty error when valid."""
    try:
        _parser.parse(formula.strip())
        return True, ""
    except UnexpectedInput as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)


def evaluate_formula(
    formula: str,
    candles: list[dict],
) -> list[dict]:
    """
    Evaluate a formula against candle data.
    Returns list of: [{name, data: [{time, value}]}]
    Raises FormulaError on evaluation errors.
    """
    if not candles:
        raise FormulaError("No candle data provided")

    times = [c.get("time") or c.get("date") for c in candles]
    n = len(candles)
    ctx: dict[str, np.ndarray] = {
        "OPEN":   np.array([float(c.get("open",   0)) for c in candles]),
        "HIGH":   np.array([float(c.get("high",   0)) for c in candles]),
        "LOW":    np.array([float(c.get("low",    0)) for c in candles]),
        "CLOSE":  np.array([float(c.get("close",  0)) for c in candles]),
        "VOL":    np.array([float(c.get("volume", 0)) for c in candles]),
        "AMOUNT": np.array([float(c.get("amount", 0)) for c in candles]),
    }

    tree = _parser.parse(formula.strip())
    evaluator = FormulaEvaluator(ctx, n)
    try:
        outputs = evaluator.transform(tree)
    except VisitError as e:
        # Unwrap FormulaError from lark's VisitError wrapper
        if e.orig_exc and isinstance(e.orig_exc, FormulaError):
            raise e.orig_exc from None
        raise FormulaError(str(e.orig_exc or e)) from None

    result = []
    for out in outputs:
        values = out["values"]
        series_data = []
        for i, t in enumerate(times):
            v = float(values[i])
            if not math.isnan(v) and not math.isinf(v):
                series_data.append({"time": t, "value": round(v, 6)})
        result.append({"name": out["name"], "data": series_data})

    return result
