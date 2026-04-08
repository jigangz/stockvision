from dataclasses import dataclass


@dataclass
class Candle:
    date: str        # YYYY-MM-DD or YYYY-MM-DD HH:MM
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float = 0.0

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "amount": self.amount,
        }
