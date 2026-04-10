import time
import logging
from datetime import datetime
from data.adapter import DataAdapter
from data.tdx_adapter import TdxAdapter  # reuse aggregation helpers
from models.candle import Candle

logger = logging.getLogger("stockvision.akshare")

# Retry config
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds between retries


def _retry(fn, description: str = "akshare call"):
    """Call fn() with retries. Raises on final failure."""
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                logger.warning(f"{description} attempt {attempt}/{MAX_RETRIES} failed: {e}, retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
            else:
                logger.error(f"{description} failed after {MAX_RETRIES} attempts: {e}")
    raise RuntimeError(f"{description} failed after {MAX_RETRIES} retries: {last_err}")


class AkshareAdapter(DataAdapter):
    """Adapter wrapping akshare for A-share market data."""

    PERIOD_MAP = {
        "daily": "daily",
        "weekly": "weekly",
        "monthly": "monthly",
    }

    # AKShare returns Chinese column names from 东方财富
    COL_MAP = {
        "日期": "date",
        "开盘": "open",
        "收盘": "close",
        "最高": "high",
        "最低": "low",
        "成交量": "volume",
        "成交额": "amount",
    }

    # Periods that need aggregation from daily AKShare data
    DAILY_AGG_MAP = {
        "quarterly":  TdxAdapter._quarter_key.__func__,
        "yearly":     TdxAdapter._year_key.__func__,
        "multi_year": TdxAdapter._multi_year_key.__func__,
    }

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        try:
            import akshare as ak
        except ImportError:
            raise RuntimeError("akshare is not installed. Run: pip install akshare")

        # Handle periods that need aggregation from daily data
        agg_fn = self.DAILY_AGG_MAP.get(period)
        if agg_fn is not None:
            daily = self.fetch_kline(code, market, "daily", start, end)
            return TdxAdapter._aggregate_by_key(daily, agg_fn)

        ak_period = self.PERIOD_MAP.get(period)
        if ak_period is None:
            if period in ("1m", "5m", "15m", "30m", "60m"):
                raise ValueError(f"AKShare 不支持分钟级数据（{period}），请切换到通达信数据源后使用分钟线")
            raise ValueError(f"Unsupported period: {period}. Use one of {list(self.PERIOD_MAP.keys()) + list(self.DAILY_AGG_MAP.keys())}")

        symbol = code

        def _do_fetch():
            return ak.stock_zh_a_hist(
                symbol=symbol,
                period=ak_period,
                start_date=start.replace("-", ""),
                end_date=end.replace("-", ""),
                adjust="qfq",
            )

        df = _retry(_do_fetch, description=f"fetch_kline({code}, {period})")

        if df is None or df.empty:
            return []

        # Rename columns to English (handles API column name changes gracefully)
        df = df.rename(columns=self.COL_MAP)

        # Fallback: if expected columns still missing, try positional mapping
        required = {"date", "open", "high", "low", "close", "volume"}
        if not required.issubset(set(df.columns)):
            logger.warning(
                f"Column mismatch! Expected {required}, got {set(df.columns)}. "
                f"AKShare may have changed its API. Attempting positional fallback."
            )
            # AKShare columns are typically: date, code, open, close, high, low, volume, amount, ...
            if len(df.columns) >= 8:
                df.columns = ["date", "_code", "open", "close", "high", "low", "volume", "amount"] + \
                             [f"_extra{i}" for i in range(len(df.columns) - 8)]
            else:
                raise RuntimeError(
                    f"AKShare API column format changed! Got columns: {df.columns.tolist()}. "
                    f"Please update akshare_adapter.py COL_MAP."
                )

        candles: list[Candle] = []
        for _, row in df.iterrows():
            candles.append(Candle(
                date=str(row["date"]),
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row["volume"]),
                amount=float(row.get("amount", 0)),
            ))

        return candles

    def fetch_stock_list(self) -> list[dict]:
        try:
            import akshare as ak
        except ImportError:
            raise RuntimeError("akshare is not installed. Run: pip install akshare")

        def _do_fetch():
            return ak.stock_zh_a_spot_em()

        df = _retry(_do_fetch, description="fetch_stock_list")

        if df is None or df.empty:
            return []

        # Rename columns
        df = df.rename(columns={"代码": "code", "名称": "name"})

        # Fallback if columns missing
        if "code" not in df.columns or "name" not in df.columns:
            logger.warning(f"Stock list columns changed: {df.columns.tolist()}")
            if len(df.columns) >= 2:
                # First two are usually code and name
                df = df.rename(columns={df.columns[0]: "code", df.columns[1]: "name"})
            else:
                raise RuntimeError(f"AKShare stock list API changed! Columns: {df.columns.tolist()}")

        stocks: list[dict] = []
        for _, row in df.iterrows():
            code_str = str(row["code"])
            stocks.append({
                "code": code_str,
                "name": str(row["name"]),
                "market": "SH" if code_str.startswith("6") else "SZ",
            })

        return stocks
