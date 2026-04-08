from abc import ABC, abstractmethod
from models.candle import Candle


class DataAdapter(ABC):
    @abstractmethod
    def fetch_kline(self, code: str, market: str, period: str, start: str, end: str) -> list[Candle]:
        ...

    @abstractmethod
    def fetch_stock_list(self) -> list[dict]:
        ...
