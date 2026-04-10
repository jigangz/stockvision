import struct
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

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        # Normalize period aliases
        period_normalized = period
        if period in ("min1", "1分"):
            period_normalized = "1min"
        elif period in ("min5", "5分"):
            period_normalized = "5min"

        filepath = self._resolve_path(code, market, period_normalized)
        if not filepath.exists():
            raise FileNotFoundError(f"TDX data file not found: {filepath}")

        start_int = int(start.replace("-", ""))
        end_int = int(end.replace("-", ""))

        if period_normalized == "daily":
            return self._read_day_file(filepath, start_int, end_int)
        else:
            return self._read_min_file(filepath, start_int, end_int)

    def fetch_stock_list(self) -> list[dict]:
        """Scan the data directory for available .day files."""
        stocks: list[dict] = []
        for market in ["sh", "sz"]:
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
