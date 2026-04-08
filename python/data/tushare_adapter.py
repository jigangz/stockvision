from data.adapter import DataAdapter
from models.candle import Candle


class TushareAdapter(DataAdapter):
    def __init__(self, token: str):
        import tushare as ts
        self.api = ts.pro_api(token)

    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        raise NotImplementedError("TushareAdapter.fetch_kline not yet implemented")

    def fetch_stock_list(self) -> list[dict]:
        raise NotImplementedError("TushareAdapter.fetch_stock_list not yet implemented")
