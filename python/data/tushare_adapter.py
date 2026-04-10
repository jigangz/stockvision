import logging
from datetime import datetime
from data.adapter import DataAdapter
from data.tdx_adapter import TdxAdapter  # reuse aggregation helpers
from models.candle import Candle

logger = logging.getLogger("stockvision.tushare")


class TushareAdapter(DataAdapter):
    """Adapter wrapping Tushare Pro API for A-share market data.

    Requires a valid Tushare Pro token.
    Free tier: ~500 calls/min, daily/weekly/monthly K-line data.
    """

    PERIOD_MAP = {
        "daily": "D",
        "weekly": "W",
        "monthly": "M",
    }

    def __init__(self, token: str):
        import tushare as ts
        ts.set_token(token)
        self.api = ts.pro_api()

    def _to_ts_code(self, code: str, market: str) -> str:
        """Convert code + market to Tushare ts_code format (e.g. 000001.SZ)."""
        return f"{code}.{market.upper()}"

    # Periods that need aggregation from daily Tushare data
    DAILY_AGG_MAP = {
        "quarterly":  TdxAdapter._quarter_key.__func__,
        "yearly":     TdxAdapter._year_key.__func__,
        "multi_year": TdxAdapter._multi_year_key.__func__,
    }

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        # Handle periods that need aggregation from daily data
        agg_fn = self.DAILY_AGG_MAP.get(period)
        if agg_fn is not None:
            daily = self.fetch_kline(code, market, "daily", start, end)
            return TdxAdapter._aggregate_by_key(daily, agg_fn)

        freq = self.PERIOD_MAP.get(period)
        if freq is None:
            if period in ("1m", "5m", "15m", "30m", "60m"):
                raise ValueError(f"Tushare 不支持分钟级数据（{period}），请切换到通达信数据源后使用分钟线")
            raise ValueError(f"Unsupported period: {period}. Use one of {list(self.PERIOD_MAP.keys()) + list(self.DAILY_AGG_MAP.keys())}")

        ts_code = self._to_ts_code(code, market)
        start_date = start.replace("-", "")
        end_date = end.replace("-", "")

        try:
            df = self.api.stk_factor(
                ts_code=ts_code,
                start_date=start_date,
                end_date=end_date,
            )
        except Exception:
            df = None

        # Primary: use daily/weekly/monthly endpoints
        try:
            if period == "daily":
                df = self.api.daily(
                    ts_code=ts_code,
                    start_date=start_date,
                    end_date=end_date,
                )
            elif period == "weekly":
                df = self.api.weekly(
                    ts_code=ts_code,
                    start_date=start_date,
                    end_date=end_date,
                )
            elif period == "monthly":
                df = self.api.monthly(
                    ts_code=ts_code,
                    start_date=start_date,
                    end_date=end_date,
                )
        except Exception as e:
            logger.error(f"Tushare fetch_kline({ts_code}, {period}) failed: {e}")
            raise RuntimeError(f"Tushare API error: {e}")

        if df is None or df.empty:
            return []

        # Tushare columns: ts_code, trade_date, open, high, low, close, vol, amount
        # vol is in 手 (100 shares), amount is in 千元
        candles: list[Candle] = []
        # Sort by date ascending (Tushare returns newest first)
        df = df.sort_values("trade_date", ascending=True)

        for _, row in df.iterrows():
            date_raw = str(row["trade_date"])
            date_str = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
            candles.append(Candle(
                date=date_str,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=float(row.get("vol", 0)) * 100,  # 手 → 股
                amount=float(row.get("amount", 0)) * 1000,  # 千元 → 元
            ))

        return candles

    def fetch_stock_list(self) -> list[dict]:
        try:
            df = self.api.stock_basic(
                exchange="",
                list_status="L",
                fields="ts_code,symbol,name,area,industry,list_date",
            )
        except Exception as e:
            logger.error(f"Tushare fetch_stock_list failed: {e}")
            raise RuntimeError(f"Tushare API error: {e}")

        if df is None or df.empty:
            return []

        stocks: list[dict] = []
        for _, row in df.iterrows():
            ts_code = str(row["ts_code"])
            code = str(row["symbol"])
            market = "SH" if ts_code.endswith(".SH") else "SZ"
            stocks.append({
                "code": code,
                "name": str(row["name"]),
                "market": market,
                "sector": str(row.get("industry", "")),
                "list_date": str(row.get("list_date", "")),
            })

        return stocks
