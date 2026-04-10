import struct
from datetime import datetime, timedelta
from pathlib import Path
from data.adapter import DataAdapter
from models.candle import Candle


class TdxAdapter(DataAdapter):
    """Read 通达信 local binary data files (.day / .5 / .1).

    .day — Daily K-line, 32 bytes per record:
      date(i32 YYYYMMDD), open(i32 *100), high(i32 *100), low(i32 *100),
      close(i32 *100), amount(f32), volume(i32), reserved(i32)

    .5 / .1 — 5-min / 1-min K-line, 32 bytes per record:
      date(u16), time(u16), open(f32), high(f32), low(f32), close(f32),
      amount(f32), volume(i32)

    Directory structure:
      vipdoc/sh/lday/sh600519.day
      vipdoc/sz/lday/sz000001.day
      vipdoc/sh/fzline/sh600519.5       (5-min)
      vipdoc/sz/fzline/sz000001.5
      vipdoc/sh/minline/sh600519.1      (1-min)
      vipdoc/sz/minline/sz000001.1
    """

    # .day format
    DAY_RECORD_SIZE = 32
    DAY_RECORD_FORMAT = "<iiiiifii"

    # .5 / .1 format (intraday)
    MIN_RECORD_SIZE = 32
    MIN_RECORD_FORMAT = "<HHffffi"  # 2+2+4*4+4 = 24... need padding
    # Actually: date(u16) + time(u16) + open(f32) + high(f32) + low(f32) + close(f32) + amount(f32) + vol(i32) = 32 bytes
    MIN_RECORD_FORMAT = "<HHfffffI"  # date, time, open, high, low, close, amount, volume

    # Period → (subdirectory, file extension)
    PERIOD_MAP = {
        "daily":  ("lday",    ".day"),
        "5min":   ("fzline",  ".5"),
        "1min":   ("minline", ".1"),
    }

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        # Auto-detect vipdoc location (may be nested one level deeper)
        if not (self.data_dir / "vipdoc").exists():
            for child in self.data_dir.iterdir():
                if (child / "vipdoc").is_dir():
                    self.data_dir = child
                    break

    def _resolve_path(self, code: str, market: str, period: str = "daily") -> Path:
        """Resolve the binary file path for a given stock and period."""
        market_lower = market.lower()
        info = self.PERIOD_MAP.get(period)
        if info is None:
            raise ValueError(f"TdxAdapter: unsupported period '{period}'. Use: {list(self.PERIOD_MAP.keys())}")
        subdir, ext = info
        filename = f"{market_lower}{code}{ext}"
        return self.data_dir / "vipdoc" / market_lower / subdir / filename

    @staticmethod
    def _decode_min_date(date_raw: int) -> str:
        """Decode .5/.1 packed date field.

        The date is encoded as: (year - 2004) * 2048 + month * 100 + day
        Some versions use: year*10000 + month*100 + day packed into u16.
        """
        # Method 1: (year-2004)*2048 + month*100 + day
        year = (date_raw >> 11) + 2004
        remainder = date_raw & 0x7FF
        month = remainder // 100
        day = remainder % 100
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
        # Fallback: treat as raw YYMMDD or similar
        return f"20{date_raw // 10000:02d}-{(date_raw % 10000) // 100:02d}-{date_raw % 100:02d}"

    @staticmethod
    def _decode_min_time(time_raw: int) -> str:
        """Decode .5/.1 time field. Encoded as HHMM (e.g. 930 = 09:30)."""
        hour = time_raw // 60
        minute = time_raw % 60
        return f"{hour:02d}:{minute:02d}"

    def _read_day_file(self, filepath: Path, start_int: int, end_int: int) -> list[Candle]:
        """Read .day binary file."""
        candles: list[Candle] = []
        with open(filepath, "rb") as f:
            while True:
                data = f.read(self.DAY_RECORD_SIZE)
                if len(data) < self.DAY_RECORD_SIZE:
                    break
                date_int, open_raw, high_raw, low_raw, close_raw, amount, volume, _ = struct.unpack(
                    self.DAY_RECORD_FORMAT, data
                )
                if date_int < start_int or date_int > end_int:
                    continue
                date_str = f"{date_int // 10000}-{(date_int % 10000) // 100:02d}-{date_int % 100:02d}"
                candles.append(Candle(
                    date=date_str,
                    open=open_raw / 100.0,
                    high=high_raw / 100.0,
                    low=low_raw / 100.0,
                    close=close_raw / 100.0,
                    volume=float(volume),
                    amount=float(amount),
                ))
        return candles

    def _read_min_file(self, filepath: Path, start_int: int, end_int: int) -> list[Candle]:
        """Read .5 or .1 binary file (intraday data)."""
        candles: list[Candle] = []
        with open(filepath, "rb") as f:
            while True:
                data = f.read(self.MIN_RECORD_SIZE)
                if len(data) < self.MIN_RECORD_SIZE:
                    break
                date_raw, time_raw, open_p, high_p, low_p, close_p, amount, volume = struct.unpack(
                    self.MIN_RECORD_FORMAT, data
                )
                date_str = self._decode_min_date(date_raw)
                date_int = int(date_str.replace("-", ""))
                if date_int < start_int or date_int > end_int:
                    continue
                time_str = self._decode_min_time(time_raw)
                candles.append(Candle(
                    date=f"{date_str} {time_str}",
                    open=round(open_p, 2),
                    high=round(high_p, 2),
                    low=round(low_p, 2),
                    close=round(close_p, 2),
                    volume=float(volume),
                    amount=float(amount),
                ))
        return candles

    @staticmethod
    def _merge_candles(candles: list[Candle]) -> Candle:
        """Merge multiple candles into one OHLCV bar."""
        return Candle(
            date=candles[-1].date,
            open=candles[0].open,
            high=max(c.high for c in candles),
            low=min(c.low for c in candles),
            close=candles[-1].close,
            volume=sum(c.volume for c in candles),
            amount=sum(c.amount for c in candles),
        )

    @staticmethod
    def _aggregate_by_key(candles: list[Candle], key_fn) -> list[Candle]:
        """Generic aggregation: group consecutive candles by key_fn, merge each group."""
        if not candles:
            return []
        result: list[Candle] = []
        buf: list[Candle] = []
        cur_key = None
        for c in candles:
            k = key_fn(c)
            if k != cur_key:
                if buf:
                    result.append(TdxAdapter._merge_candles(buf))
                buf = [c]
                cur_key = k
            else:
                buf.append(c)
        if buf:
            result.append(TdxAdapter._merge_candles(buf))
        return result

    @staticmethod
    def _week_key(c: Candle):
        dt = datetime.strptime(c.date[:10], "%Y-%m-%d")
        iso = dt.isocalendar()
        return iso[0] * 100 + iso[1]

    @staticmethod
    def _month_key(c: Candle):
        return c.date[:7]  # "YYYY-MM"

    @staticmethod
    def _quarter_key(c: Candle):
        y, m = int(c.date[:4]), int(c.date[5:7])
        return y * 10 + ((m - 1) // 3)

    @staticmethod
    def _year_key(c: Candle):
        return c.date[:4]  # "YYYY"

    @staticmethod
    def _multi_year_key(c: Candle):
        """Group by 3-year blocks."""
        y = int(c.date[:4])
        return y // 3

    # Periods that aggregate from daily data
    DAILY_AGG_MAP = {
        "weekly":     _week_key.__func__,
        "monthly":    _month_key.__func__,
        "quarterly":  _quarter_key.__func__,
        "yearly":     _year_key.__func__,
        "multi_year": _multi_year_key.__func__,
    }

    # Periods that aggregate from 5-min data
    MIN5_AGG_BARS = {
        "15m": 3,   # 3 x 5min = 15min
        "30m": 6,   # 6 x 5min = 30min
        "60m": 12,  # 12 x 5min = 60min
    }

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        # Normalize period aliases
        p = period
        if p in ("min1", "1分"):
            p = "1m"
        elif p in ("min5", "5分"):
            p = "5m"
        elif p in ("1min",):
            p = "1m"
        elif p in ("5min",):
            p = "5m"

        start_int = int(start.replace("-", ""))
        end_int = int(end.replace("-", ""))

        # --- Aggregate from daily ---
        agg_fn = self.DAILY_AGG_MAP.get(p)
        if agg_fn is not None:
            filepath = self._resolve_path(code, market, "daily")
            if not filepath.exists():
                raise FileNotFoundError(f"TDX data file not found: {filepath}")
            daily = self._read_day_file(filepath, start_int, end_int)
            return self._aggregate_by_key(daily, agg_fn)

        # --- Aggregate from 5-min (15m / 30m / 60m) ---
        n_bars = self.MIN5_AGG_BARS.get(p)
        if n_bars is not None:
            filepath = self._resolve_path(code, market, "5min")
            if not filepath.exists():
                raise FileNotFoundError(f"TDX 5-min data file not found: {filepath}")
            m5 = self._read_min_file(filepath, start_int, end_int)
            return self._aggregate_n(m5, n_bars)

        # --- Raw files: daily / 5m / 1m ---
        if p == "daily":
            filepath = self._resolve_path(code, market, "daily")
        elif p == "5m":
            filepath = self._resolve_path(code, market, "5min")
        elif p == "1m":
            filepath = self._resolve_path(code, market, "1min")
        else:
            raise ValueError(f"TdxAdapter: unsupported period '{period}'")

        if not filepath.exists():
            raise FileNotFoundError(f"TDX data file not found: {filepath}")

        if p == "daily":
            return self._read_day_file(filepath, start_int, end_int)
        else:
            return self._read_min_file(filepath, start_int, end_int)

    @staticmethod
    def _aggregate_n(candles: list[Candle], n: int) -> list[Candle]:
        """Aggregate every N consecutive candles into one bar."""
        if not candles:
            return []
        result: list[Candle] = []
        for i in range(0, len(candles), n):
            chunk = candles[i:i + n]
            result.append(TdxAdapter._merge_candles(chunk))
        return result

    def fetch_stock_list(self) -> list[dict]:
        """Scan the data directory for available .day files."""
        stocks: list[dict] = []
        for market in ["sh", "sz", "bj"]:
            lday_dir = self.data_dir / "vipdoc" / market / "lday"
            if not lday_dir.exists():
                continue
            for f in lday_dir.glob(f"{market}*.day"):
                code = f.stem[2:]  # strip market prefix
                stocks.append({
                    "code": code,
                    "name": "",  # TDX binary files don't contain stock names
                    "market": market.upper(),
                })
        return stocks
