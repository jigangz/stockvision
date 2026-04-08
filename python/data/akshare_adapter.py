from data.adapter import DataAdapter
from models.candle import Candle


class AkshareAdapter(DataAdapter):
    """Adapter wrapping akshare for A-share market data."""

    PERIOD_MAP = {
        "daily": "daily",
        "weekly": "weekly",
        "monthly": "monthly",
    }

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        try:
            import akshare as ak
        except ImportError:
            raise RuntimeError("akshare is not installed. Run: pip install akshare")

        ak_period = self.PERIOD_MAP.get(period)
        if ak_period is None:
            raise ValueError(f"Unsupported period: {period}. Use one of {list(self.PERIOD_MAP.keys())}")

        # akshare expects symbol without market prefix for A-shares
        symbol = code

        try:
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period=ak_period,
                start_date=start.replace("-", ""),
                end_date=end.replace("-", ""),
                adjust="qfq",  # 前复权
            )
        except Exception as e:
            raise RuntimeError(f"Failed to fetch kline from akshare for {code}: {e}")

        if df is None or df.empty:
            return []

        candles: list[Candle] = []
        for _, row in df.iterrows():
            candles.append(Candle(
                date=str(row["日期"]),
                open=float(row["开盘"]),
                high=float(row["最高"]),
                low=float(row["最低"]),
                close=float(row["收盘"]),
                volume=float(row["成交量"]),
                amount=float(row.get("成交额", 0)),
            ))

        return candles

    def fetch_stock_list(self) -> list[dict]:
        try:
            import akshare as ak
        except ImportError:
            raise RuntimeError("akshare is not installed. Run: pip install akshare")

        try:
            df = ak.stock_zh_a_spot_em()
        except Exception as e:
            raise RuntimeError(f"Failed to fetch stock list from akshare: {e}")

        if df is None or df.empty:
            return []

        stocks: list[dict] = []
        for _, row in df.iterrows():
            stocks.append({
                "code": str(row["代码"]),
                "name": str(row["名称"]),
                "market": "SH" if str(row["代码"]).startswith("6") else "SZ",
            })

        return stocks
