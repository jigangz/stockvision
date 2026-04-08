"""
Technical indicator calculations for all 22 通达信 indicators.
Uses pandas/numpy for vectorized operations.
All functions accept a pandas DataFrame with columns: time, open, high, low, close, volume.
All functions return a dict: { series: [{name, type, data: [{time, value, color?}]}] }
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def _to_series_entry(df: pd.DataFrame, col: str, name: str, series_type: str = "line",
                     color: str | None = None) -> dict:
    vals = df[col]
    data = []
    for i, row in df.iterrows():
        v = vals[i]
        if v is None or (isinstance(v, float) and math.isnan(v)):
            continue
        entry: dict = {"time": row["time"], "value": round(float(v), 6)}
        if color:
            entry["color"] = color
        data.append(entry)
    return {"name": name, "type": series_type, "data": data}


def _histogram_series(df: pd.DataFrame, col: str, name: str,
                      up_color: str = "#FF4444", dn_color: str = "#00CC66") -> dict:
    vals = df[col]
    data = []
    for i, row in df.iterrows():
        v = vals[i]
        if v is None or (isinstance(v, float) and math.isnan(v)):
            continue
        data.append({
            "time": row["time"],
            "value": round(float(v), 6),
            "color": up_color if v >= 0 else dn_color,
        })
    return {"name": name, "type": "histogram", "data": data}


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def _rma(series: pd.Series, period: int) -> pd.Series:
    """Wilder's smoothing (RMA)."""
    alpha = 1.0 / period
    result = series.ewm(alpha=alpha, adjust=False).mean()
    return result


# ── 1. MACD ──────────────────────────────────────────────────────────────────

def calc_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    close = df["close"]
    ema_fast = _ema(close, fast)
    ema_slow = _ema(close, slow)
    dif = ema_fast - ema_slow
    dea = _ema(dif, signal)
    hist = 2 * (dif - dea)

    df2 = df.copy()
    df2["DIF"] = dif
    df2["DEA"] = dea
    df2["HIST"] = hist

    return {
        "series": [
            _to_series_entry(df2, "DIF", "DIF", "line", "#FFFFFF"),
            _to_series_entry(df2, "DEA", "DEA", "line", "#FFFF00"),
            _histogram_series(df2, "HIST", "MACD"),
        ]
    }


# ── 2. DMA ────────────────────────────────────────────────────────────────────

def calc_dma(df: pd.DataFrame, n1: int = 10, n2: int = 50, m: int = 10) -> dict:
    close = df["close"]
    ma1 = _sma(close, n1)
    ma2 = _sma(close, n2)
    dif = ma1 - ma2
    difma = _sma(dif, m)

    df2 = df.copy()
    df2["DIF"] = dif
    df2["DIFMA"] = difma

    return {
        "series": [
            _to_series_entry(df2, "DIF", "DIF", "line", "#FFFFFF"),
            _to_series_entry(df2, "DIFMA", "DIFMA", "line", "#FFFF00"),
        ]
    }


# ── 3. DMI ────────────────────────────────────────────────────────────────────

def calc_dmi(df: pd.DataFrame, period: int = 14) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]

    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)

    up_move = high - high.shift(1)
    dn_move = low.shift(1) - low

    plus_dm = np.where((up_move > dn_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((dn_move > up_move) & (dn_move > 0), dn_move, 0.0)

    plus_dm_s = pd.Series(plus_dm, index=df.index)
    minus_dm_s = pd.Series(minus_dm, index=df.index)

    atr = _rma(tr, period)
    plus_di = 100 * _rma(plus_dm_s, period) / atr
    minus_di = 100 * _rma(minus_dm_s, period) / atr

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    adx = _rma(dx.fillna(0), period)
    adxr = (adx + adx.shift(period)) / 2

    df2 = df.copy()
    df2["+DI"] = plus_di
    df2["-DI"] = minus_di
    df2["ADX"] = adx
    df2["ADXR"] = adxr

    return {
        "series": [
            _to_series_entry(df2, "+DI", "+DI", "line", "#FF4444"),
            _to_series_entry(df2, "-DI", "-DI", "line", "#00CC66"),
            _to_series_entry(df2, "ADX", "ADX", "line", "#FFFF00"),
            _to_series_entry(df2, "ADXR", "ADXR", "line", "#FF00FF"),
        ]
    }


# ── 4. TRIX ───────────────────────────────────────────────────────────────────

def calc_trix(df: pd.DataFrame, period: int = 12, signal: int = 20) -> dict:
    close = df["close"]
    ema1 = _ema(close, period)
    ema2 = _ema(ema1, period)
    ema3 = _ema(ema2, period)
    trix = (ema3 - ema3.shift(1)) / ema3.shift(1) * 100
    matrix = _sma(trix, signal)

    df2 = df.copy()
    df2["TRIX"] = trix
    df2["MATRIX"] = matrix

    return {
        "series": [
            _to_series_entry(df2, "TRIX", "TRIX", "line", "#FFFFFF"),
            _to_series_entry(df2, "MATRIX", "MATRIX", "line", "#FFFF00"),
        ]
    }


# ── 5. FSL (Fast Slow Lines) ──────────────────────────────────────────────────

def calc_fsl(df: pd.DataFrame, fast: int = 5, slow: int = 20) -> dict:
    close = df["close"]
    fls = _ema(close, fast)
    sls = _ema(close, slow)

    df2 = df.copy()
    df2["FLS"] = fls
    df2["SLS"] = sls

    return {
        "series": [
            _to_series_entry(df2, "FLS", "FLS", "line", "#FFFF00"),
            _to_series_entry(df2, "SLS", "SLS", "line", "#FF00FF"),
        ]
    }


# ── 6. EMV (Ease of Movement) ─────────────────────────────────────────────────

def calc_emv(df: pd.DataFrame, period: int = 14, signal: int = 9) -> dict:
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    midpoint_move = (high + low) / 2 - (high.shift(1) + low.shift(1)) / 2
    hl_ratio = (high - low) / (volume / 1e6 + 1e-10)
    emv_raw = midpoint_move / (hl_ratio + 1e-10)
    emv = _sma(emv_raw, period)
    emv_signal = _sma(emv, signal)

    df2 = df.copy()
    df2["EMV"] = emv
    df2["MAEMV"] = emv_signal

    return {
        "series": [
            _to_series_entry(df2, "EMV", "EMV", "line", "#FFFFFF"),
            _to_series_entry(df2, "MAEMV", "MAEMV", "line", "#FFFF00"),
        ]
    }


# ── 7. RSI ────────────────────────────────────────────────────────────────────

def calc_rsi(df: pd.DataFrame, p1: int = 6, p2: int = 12, p3: int = 24) -> dict:
    def rsi(close: pd.Series, period: int) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = _rma(gain, period)
        avg_loss = _rma(loss, period)
        rs = avg_gain / (avg_loss + 1e-10)
        return 100 - 100 / (1 + rs)

    close = df["close"]
    df2 = df.copy()
    df2["RSI6"] = rsi(close, p1)
    df2["RSI12"] = rsi(close, p2)
    df2["RSI24"] = rsi(close, p3)

    return {
        "series": [
            _to_series_entry(df2, "RSI6", "RSI6", "line", "#FFFF00"),
            _to_series_entry(df2, "RSI12", "RSI12", "line", "#FF00FF"),
            _to_series_entry(df2, "RSI24", "RSI24", "line", "#FFFFFF"),
        ]
    }


# ── 8. KDJ ────────────────────────────────────────────────────────────────────

def calc_kdj(df: pd.DataFrame, period: int = 9, k_smooth: int = 3, d_smooth: int = 3) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]

    lowest_low = low.rolling(window=period).min()
    highest_high = high.rolling(window=period).max()

    rsv = (close - lowest_low) / (highest_high - lowest_low + 1e-10) * 100

    k = rsv.ewm(com=k_smooth - 1, adjust=False).mean()
    d = k.ewm(com=d_smooth - 1, adjust=False).mean()
    j = 3 * k - 2 * d

    df2 = df.copy()
    df2["K"] = k
    df2["D"] = d
    df2["J"] = j

    return {
        "series": [
            _to_series_entry(df2, "K", "K", "line", "#FFFF00"),
            _to_series_entry(df2, "D", "D", "line", "#FF00FF"),
            _to_series_entry(df2, "J", "J", "line", "#FFFFFF"),
        ]
    }


# ── 9. WR (Williams %R) ───────────────────────────────────────────────────────

def calc_wr(df: pd.DataFrame, p1: int = 10, p2: int = 6) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]

    def williams_r(p: int) -> pd.Series:
        hh = high.rolling(window=p).max()
        ll = low.rolling(window=p).min()
        return (hh - close) / (hh - ll + 1e-10) * (-100)

    df2 = df.copy()
    df2["WR10"] = williams_r(p1)
    df2["WR6"] = williams_r(p2)

    return {
        "series": [
            _to_series_entry(df2, "WR10", "WR10", "line", "#FFFFFF"),
            _to_series_entry(df2, "WR6", "WR6", "line", "#FFFF00"),
        ]
    }


# ── 10. CCI ───────────────────────────────────────────────────────────────────

def calc_cci(df: pd.DataFrame, period: int = 14) -> dict:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    ma = tp.rolling(window=period).mean()
    md = tp.rolling(window=period).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    cci = (tp - ma) / (0.015 * md + 1e-10)

    df2 = df.copy()
    df2["CCI"] = cci

    return {
        "series": [
            _to_series_entry(df2, "CCI", "CCI", "line", "#FFFF00"),
        ]
    }


# ── 11. ROC ───────────────────────────────────────────────────────────────────

def calc_roc(df: pd.DataFrame, period: int = 12, signal: int = 6) -> dict:
    close = df["close"]
    roc = (close - close.shift(period)) / (close.shift(period) + 1e-10) * 100
    rocma = _sma(roc, signal)

    df2 = df.copy()
    df2["ROC"] = roc
    df2["ROCMA"] = rocma

    return {
        "series": [
            _to_series_entry(df2, "ROC", "ROC", "line", "#FFFF00"),
            _to_series_entry(df2, "ROCMA", "ROCMA", "line", "#FF00FF"),
        ]
    }


# ── 12. MTM ───────────────────────────────────────────────────────────────────

def calc_mtm(df: pd.DataFrame, period: int = 12, signal: int = 6) -> dict:
    close = df["close"]
    mtm = close - close.shift(period)
    mtmma = _sma(mtm, signal)

    df2 = df.copy()
    df2["MTM"] = mtm
    df2["MTMMA"] = mtmma

    return {
        "series": [
            _to_series_entry(df2, "MTM", "MTM", "line", "#FFFF00"),
            _to_series_entry(df2, "MTMMA", "MTMMA", "line", "#FF00FF"),
        ]
    }


# ── 13. PSY ───────────────────────────────────────────────────────────────────

def calc_psy(df: pd.DataFrame, period: int = 12, signal: int = 6) -> dict:
    close = df["close"]
    up = (close > close.shift(1)).astype(float)
    psy = up.rolling(window=period).sum() / period * 100
    psyma = _sma(psy, signal)

    df2 = df.copy()
    df2["PSY"] = psy
    df2["PSYMA"] = psyma

    return {
        "series": [
            _to_series_entry(df2, "PSY", "PSY", "line", "#FFFF00"),
            _to_series_entry(df2, "PSYMA", "PSYMA", "line", "#FF00FF"),
        ]
    }


# ── 14. VOL-TDX (Volume) ──────────────────────────────────────────────────────

def calc_vol_tdx(df: pd.DataFrame, ma1: int = 5, ma2: int = 10) -> dict:
    volume = df["volume"]
    close = df["close"]
    prev_close = close.shift(1)

    vol_color_list = []
    for i in range(len(df)):
        if i == 0:
            vol_color_list.append("#CCCCCC")
        elif df["close"].iloc[i] >= prev_close.iloc[i]:
            vol_color_list.append("#FF4444")
        else:
            vol_color_list.append("#00CC66")

    vol_ma1 = _sma(volume, ma1)
    vol_ma2 = _sma(volume, ma2)

    # Build histogram with colors
    hist_data = []
    for i, row in df.iterrows():
        v = volume.iloc[i] if hasattr(i, '__index__') else volume[i]
        idx = df.index.get_loc(i)
        hist_data.append({
            "time": row["time"],
            "value": round(float(volume.iloc[idx]), 2),
            "color": vol_color_list[idx],
        })

    df2 = df.copy()
    df2["VOLMA5"] = vol_ma1
    df2["VOLMA10"] = vol_ma2

    return {
        "series": [
            {"name": "VOL", "type": "histogram", "data": hist_data},
            _to_series_entry(df2, "VOLMA5", "VOLMA5", "line", "#FFFF00"),
            _to_series_entry(df2, "VOLMA10", "VOLMA10", "line", "#FF00FF"),
        ]
    }


# ── 15. OBV ───────────────────────────────────────────────────────────────────

def calc_obv(df: pd.DataFrame) -> dict:
    close = df["close"]
    volume = df["volume"]

    obv = [0.0]
    for i in range(1, len(df)):
        if close.iloc[i] > close.iloc[i - 1]:
            obv.append(obv[-1] + volume.iloc[i])
        elif close.iloc[i] < close.iloc[i - 1]:
            obv.append(obv[-1] - volume.iloc[i])
        else:
            obv.append(obv[-1])

    df2 = df.copy()
    df2["OBV"] = obv
    df2["MAOBV"] = _sma(pd.Series(obv, index=df.index), 30)

    return {
        "series": [
            _to_series_entry(df2, "OBV", "OBV", "line", "#FFFF00"),
            _to_series_entry(df2, "MAOBV", "MAOBV", "line", "#FF00FF"),
        ]
    }


# ── 16. VR (Volume Ratio) ─────────────────────────────────────────────────────

def calc_vr(df: pd.DataFrame, period: int = 26) -> dict:
    close = df["close"]
    volume = df["volume"]
    prev_close = close.shift(1)

    up_vol = volume.where(close >= prev_close, 0.0).fillna(0.0)
    dn_vol = volume.where(close < prev_close, 0.0).fillna(0.0)

    sum_up = up_vol.rolling(window=period).sum()
    sum_dn = dn_vol.rolling(window=period).sum()
    vr = sum_up / (sum_dn + 1e-10) * 100
    mavr = _sma(vr, 6)

    df2 = df.copy()
    df2["VR"] = vr
    df2["MAVR"] = mavr

    return {
        "series": [
            _to_series_entry(df2, "VR", "VR", "line", "#FFFF00"),
            _to_series_entry(df2, "MAVR", "MAVR", "line", "#FF00FF"),
        ]
    }


# ── 17. ASI (Accumulation Swing Index) ───────────────────────────────────────

def calc_asi(df: pd.DataFrame, period: int = 14) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    open_ = df["open"]

    pc = close.shift(1)
    ph = high.shift(1)
    pl = low.shift(1)

    r = pd.concat([
        (high - pc).abs(),
        (low - pc).abs(),
        (high - low).abs(),
    ], axis=1).max(axis=1)

    # Wilder's SI approximation
    k = pd.concat([(high - pc).abs(), (low - pc).abs()], axis=1).max(axis=1)
    t = r + 0.25 * (pc - open_).abs()

    si = 50 * (close - pc + 0.5 * (close - open_) + 0.25 * (pc - open_)) / (t + 1e-10) * (k / (r + 1e-10))
    asi_series = si.cumsum()
    masi = _sma(asi_series, period)

    df2 = df.copy()
    df2["ASI"] = asi_series
    df2["MASI"] = masi

    return {
        "series": [
            _to_series_entry(df2, "ASI", "ASI", "line", "#FFFF00"),
            _to_series_entry(df2, "MASI", "MASI", "line", "#FF00FF"),
        ]
    }


# ── 18. BOLL (Bollinger Bands) ────────────────────────────────────────────────

def calc_boll(df: pd.DataFrame, period: int = 20, std_mult: float = 2.0) -> dict:
    close = df["close"]
    mid = _sma(close, period)
    std = close.rolling(window=period).std(ddof=0)
    upper = mid + std_mult * std
    lower = mid - std_mult * std

    df2 = df.copy()
    df2["UPPER"] = upper
    df2["MID"] = mid
    df2["LOWER"] = lower

    return {
        "series": [
            _to_series_entry(df2, "UPPER", "UPPER", "line", "#FF4444"),
            _to_series_entry(df2, "MID", "MID", "line", "#FFFF00"),
            _to_series_entry(df2, "LOWER", "LOWER", "line", "#00CC66"),
        ]
    }


# ── 19. SAR (Parabolic SAR) ───────────────────────────────────────────────────

def calc_sar(df: pd.DataFrame, initial_af: float = 0.02, max_af: float = 0.2) -> dict:
    high = df["high"].values
    low = df["low"].values
    n = len(df)

    if n < 2:
        return {"series": [{"name": "SAR", "type": "line", "data": []}]}

    sar_vals = [0.0] * n
    ep_vals = [0.0] * n
    af_vals = [0.0] * n
    trend = [1] * n  # 1 = uptrend, -1 = downtrend

    # Initialize
    trend[0] = 1
    sar_vals[0] = low[0]
    ep_vals[0] = high[0]
    af_vals[0] = initial_af

    for i in range(1, n):
        prev_sar = sar_vals[i - 1]
        prev_ep = ep_vals[i - 1]
        prev_af = af_vals[i - 1]
        prev_trend = trend[i - 1]

        sar = prev_sar + prev_af * (prev_ep - prev_sar)

        if prev_trend == 1:
            if low[i] < sar:
                # Reversal to downtrend
                trend[i] = -1
                sar = prev_ep
                ep = low[i]
                af = initial_af
            else:
                trend[i] = 1
                ep = max(prev_ep, high[i])
                af = min(prev_af + initial_af, max_af) if high[i] > prev_ep else prev_af
                sar = min(sar, low[i - 1], low[max(0, i - 2)])
        else:
            if high[i] > sar:
                # Reversal to uptrend
                trend[i] = 1
                sar = prev_ep
                ep = high[i]
                af = initial_af
            else:
                trend[i] = -1
                ep = min(prev_ep, low[i])
                af = min(prev_af + initial_af, max_af) if low[i] < prev_ep else prev_af
                sar = max(sar, high[i - 1], high[max(0, i - 2)])

        sar_vals[i] = sar
        ep_vals[i] = ep
        af_vals[i] = af

    times = df["time"].tolist()
    data = [{"time": times[i], "value": round(sar_vals[i], 4)} for i in range(n)]

    return {
        "series": [
            {"name": "SAR", "type": "line", "data": data},
        ]
    }


# ── 20. BRAR ──────────────────────────────────────────────────────────────────

def calc_brar(df: pd.DataFrame, period: int = 26) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    open_ = df["open"]
    prev_close = close.shift(1)

    hmo = (high - open_).clip(lower=0)
    oml = (open_ - low).clip(lower=0)
    hmc = (high - prev_close).clip(lower=0)
    cml = (prev_close - low).clip(lower=0)

    ar = hmo.rolling(period).sum() / (oml.rolling(period).sum() + 1e-10) * 100
    br = hmc.rolling(period).sum() / (cml.rolling(period).sum() + 1e-10) * 100

    df2 = df.copy()
    df2["AR"] = ar
    df2["BR"] = br

    return {
        "series": [
            _to_series_entry(df2, "AR", "AR", "line", "#FFFF00"),
            _to_series_entry(df2, "BR", "BR", "line", "#FF00FF"),
        ]
    }


# ── 21. CR ────────────────────────────────────────────────────────────────────

def calc_cr(df: pd.DataFrame, period: int = 26, m: int = 5) -> dict:
    high = df["high"]
    low = df["low"]
    close = df["close"]

    # Previous midprice
    ym = (high.shift(1) + low.shift(1) + close.shift(1)) / 3

    p1 = (high - ym).clip(lower=0)
    p2 = (ym - low).clip(lower=0)

    cr = p1.rolling(period).sum() / (p2.rolling(period).sum() + 1e-10) * 100
    ma1 = _sma(cr, m)
    ma2 = _sma(cr, m * 2)
    ma3 = _sma(cr, m * 4)

    df2 = df.copy()
    df2["CR"] = cr
    df2["MA1"] = ma1
    df2["MA2"] = ma2
    df2["MA3"] = ma3

    return {
        "series": [
            _to_series_entry(df2, "CR", "CR", "line", "#FFFF00"),
            _to_series_entry(df2, "MA1", "MA1", "line", "#FF00FF"),
            _to_series_entry(df2, "MA2", "MA2", "line", "#FFFFFF"),
            _to_series_entry(df2, "MA3", "MA3", "line", "#00FF00"),
        ]
    }


# ── 22. MOST (Moving Average Stop) ───────────────────────────────────────────

def calc_most(df: pd.DataFrame, period: int = 14, pct: float = 2.0) -> dict:
    """
    MOST: EMA-based trailing stop.
    MOST line = EMA(close, period)
    Stop band = MOST ± pct%
    """
    close = df["close"]
    most_line = _ema(close, period)
    upper = most_line * (1 + pct / 100)
    lower = most_line * (1 - pct / 100)

    df2 = df.copy()
    df2["MOST"] = most_line
    df2["UPPER"] = upper
    df2["LOWER"] = lower

    return {
        "series": [
            _to_series_entry(df2, "MOST", "MOST", "line", "#FFFF00"),
            _to_series_entry(df2, "UPPER", "UPPER", "line", "#FF4444"),
            _to_series_entry(df2, "LOWER", "LOWER", "line", "#00CC66"),
        ]
    }


# ── Dispatch ──────────────────────────────────────────────────────────────────

INDICATOR_FUNCS: dict[str, Any] = {
    "MACD": calc_macd,
    "DMA": calc_dma,
    "DMI": calc_dmi,
    "TRIX": calc_trix,
    "FSL": calc_fsl,
    "EMV": calc_emv,
    "RSI": calc_rsi,
    "KDJ": calc_kdj,
    "WR": calc_wr,
    "CCI": calc_cci,
    "ROC": calc_roc,
    "MTM": calc_mtm,
    "PSY": calc_psy,
    "VOL": calc_vol_tdx,
    "OBV": calc_obv,
    "VR": calc_vr,
    "ASI": calc_asi,
    "BOLL": calc_boll,
    "SAR": calc_sar,
    "BRAR": calc_brar,
    "CR": calc_cr,
    "MOST": calc_most,
}

ALL_INDICATORS = list(INDICATOR_FUNCS.keys())


def calculate(data: list[dict], indicator: str, params: dict | None = None) -> dict:
    """
    Main entry point.
    data: list of candle dicts with keys: time (or date), open, high, low, close, volume
    indicator: one of ALL_INDICATORS
    params: optional dict of extra parameters (currently unused, for future use)
    """
    if indicator not in INDICATOR_FUNCS:
        raise ValueError(f"Unknown indicator: {indicator}. Available: {ALL_INDICATORS}")

    df = pd.DataFrame(data)

    # Normalize time column (may be 'date' or 'time')
    if "date" in df.columns and "time" not in df.columns:
        df = df.rename(columns={"date": "time"})
    elif "time" not in df.columns:
        raise ValueError("Data must have 'time' or 'date' column")

    # Ensure numeric columns
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.sort_values("time").reset_index(drop=True)

    func = INDICATOR_FUNCS[indicator]
    result = func(df)
    result["indicator"] = indicator
    return result
