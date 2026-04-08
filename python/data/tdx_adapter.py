import struct
from pathlib import Path
from data.adapter import DataAdapter
from models.candle import Candle


class TdxAdapter(DataAdapter):
    """Read 通达信 .day binary files.

    Each record is 32 bytes:
      - date:     int32  (YYYYMMDD)
      - open:     int32  (price * 100)
      - high:     int32  (price * 100)
      - low:      int32  (price * 100)
      - close:    int32  (price * 100)
      - amount:   float32
      - volume:   int32
      - reserved: int32
    """

    RECORD_SIZE = 32
    RECORD_FORMAT = "<iiiiifii"

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)

    def _resolve_path(self, code: str, market: str) -> Path:
        """Resolve the .day file path for a given stock.

        通达信 stores files like:
          vipdoc/sh/lday/sh600519.day
          vipdoc/sz/lday/sz000001.day
        """
        market_lower = market.lower()
        filename = f"{market_lower}{code}.day"
        return self.data_dir / "vipdoc" / market_lower / "lday" / filename

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        if period != "daily":
            raise ValueError("TdxAdapter only supports daily period from .day files")

        filepath = self._resolve_path(code, market)
        if not filepath.exists():
            raise FileNotFoundError(f"TDX data file not found: {filepath}")

        start_int = int(start.replace("-", ""))
        end_int = int(end.replace("-", ""))

        candles: list[Candle] = []

        with open(filepath, "rb") as f:
            while True:
                data = f.read(self.RECORD_SIZE)
                if len(data) < self.RECORD_SIZE:
                    break

                date_int, open_raw, high_raw, low_raw, close_raw, amount, volume, _ = struct.unpack(
                    self.RECORD_FORMAT, data
                )

                if date_int < start_int or date_int > end_int:
                    continue

                # Format date as YYYY-MM-DD
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
