import sqlite3
from pathlib import Path
from models.candle import Candle

try:
    import pandas as pd
except ImportError:
    pd = None  # type: ignore


DATA_DIR = Path(__file__).parent.parent / "data_store"
DB_PATH = DATA_DIR / "stockvision.db"


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def init_db() -> None:
    """Initialize SQLite database with stocks table."""
    _ensure_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            sector TEXT,
            list_date TEXT
        )
    """)
    conn.commit()
    conn.close()


def save_candles(candles: list[Candle], code: str, market: str, period: str) -> Path:
    """Save candles to a parquet file. Returns the file path."""
    if pd is None:
        raise RuntimeError("pandas is required for parquet storage")

    _ensure_dir()
    filename = f"{market}_{code}_{period}.parquet"
    filepath = DATA_DIR / filename

    df = pd.DataFrame([c.to_dict() for c in candles])
    df.to_parquet(filepath, engine="pyarrow", index=False)

    return filepath


def load_candles(code: str, market: str, period: str) -> list[Candle] | None:
    """Load candles from a parquet file. Returns None if file doesn't exist."""
    if pd is None:
        raise RuntimeError("pandas is required for parquet storage")

    filename = f"{market}_{code}_{period}.parquet"
    filepath = DATA_DIR / filename

    if not filepath.exists():
        return None

    df = pd.read_parquet(filepath, engine="pyarrow")

    return [
        Candle(
            date=str(row["date"]),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
            amount=float(row.get("amount", 0)),
        )
        for _, row in df.iterrows()
    ]


def save_stock_list(stocks: list[dict]) -> None:
    """Upsert stock list into SQLite."""
    _ensure_dir()
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    for s in stocks:
        conn.execute(
            """INSERT OR REPLACE INTO stocks (code, name, market, sector, list_date)
               VALUES (?, ?, ?, ?, ?)""",
            (s["code"], s["name"], s["market"], s.get("sector"), s.get("list_date")),
        )
    conn.commit()
    conn.close()


def load_stock_list() -> list[dict]:
    """Load stock list from SQLite."""
    _ensure_dir()
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute("SELECT code, name, market, sector, list_date FROM stocks")
    stocks = [
        {"code": row[0], "name": row[1], "market": row[2], "sector": row[3], "list_date": row[4]}
        for row in cursor.fetchall()
    ]
    conn.close()
    return stocks
