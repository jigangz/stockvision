import json
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


def init_config_table() -> None:
    """Initialize SQLite config table."""
    _ensure_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_config(key: str, value: str) -> None:
    """Save a config value to SQLite."""
    _ensure_dir()
    init_config_table()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (key, value),
    )
    conn.commit()
    conn.close()


def load_config(key: str, default: str | None = None) -> str | None:
    """Load a config value from SQLite."""
    _ensure_dir()
    init_config_table()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else default


def load_all_config() -> dict[str, str]:
    """Load all config values from SQLite."""
    _ensure_dir()
    init_config_table()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute("SELECT key, value FROM config")
    result = {row[0]: row[1] for row in cursor.fetchall()}
    conn.close()
    return result


def init_drawings_table() -> None:
    """Initialize SQLite drawings table."""
    _ensure_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS drawings (
            id TEXT NOT NULL,
            stock_code TEXT NOT NULL,
            period TEXT NOT NULL,
            type TEXT NOT NULL,
            points TEXT NOT NULL,
            style TEXT NOT NULL,
            text TEXT,
            PRIMARY KEY (id, stock_code, period)
        )
    """)
    conn.commit()
    conn.close()


def save_drawing(stock_code: str, period: str, drawing: dict) -> None:
    """Upsert a drawing into SQLite."""
    _ensure_dir()
    init_drawings_table()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        """INSERT OR REPLACE INTO drawings (id, stock_code, period, type, points, style, text)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            drawing["id"],
            stock_code,
            period,
            drawing["type"],
            json.dumps(drawing["points"]),
            json.dumps(drawing["style"]),
            drawing.get("text"),
        ),
    )
    conn.commit()
    conn.close()


def load_drawings(stock_code: str, period: str) -> list[dict]:
    """Load all drawings for a stock/period."""
    _ensure_dir()
    init_drawings_table()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute(
        "SELECT id, type, points, style, text FROM drawings WHERE stock_code = ? AND period = ?",
        (stock_code, period),
    )
    drawings = []
    for row in cursor.fetchall():
        d: dict = {
            "id": row[0],
            "type": row[1],
            "points": json.loads(row[2]),
            "style": json.loads(row[3]),
        }
        if row[4] is not None:
            d["text"] = row[4]
        drawings.append(d)
    conn.close()
    return drawings


def delete_drawing(drawing_id: str, stock_code: str, period: str) -> None:
    """Delete a specific drawing."""
    _ensure_dir()
    init_drawings_table()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "DELETE FROM drawings WHERE id = ? AND stock_code = ? AND period = ?",
        (drawing_id, stock_code, period),
    )
    conn.commit()
    conn.close()


def clear_drawings(stock_code: str, period: str) -> None:
    """Delete all drawings for a stock/period."""
    _ensure_dir()
    init_drawings_table()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "DELETE FROM drawings WHERE stock_code = ? AND period = ?",
        (stock_code, period),
    )
    conn.commit()
    conn.close()


def init_import_logs_table() -> None:
    """Initialize SQLite import_logs table."""
    _ensure_dir()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS import_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            source TEXT NOT NULL,
            filename TEXT NOT NULL,
            count INTEGER NOT NULL,
            status TEXT NOT NULL,
            details TEXT
        )
    """)
    conn.commit()
    conn.close()


def add_import_log(
    source: str,
    filename: str,
    count: int,
    status: str,
    details: str | None = None,
) -> None:
    """Insert a new import log entry."""
    _ensure_dir()
    init_import_logs_table()
    from datetime import datetime
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        """INSERT INTO import_logs (timestamp, source, filename, count, status, details)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), source, filename, count, status, details),
    )
    conn.commit()
    conn.close()


def load_import_logs(limit: int = 50) -> list[dict]:
    """Load import logs, newest first."""
    _ensure_dir()
    init_import_logs_table()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.execute(
        "SELECT id, timestamp, source, filename, count, status, details FROM import_logs ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    logs = [
        {
            "id": row[0],
            "timestamp": row[1],
            "source": row[2],
            "filename": row[3],
            "count": row[4],
            "status": row[5],
            "details": row[6],
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    return logs


def clear_import_logs() -> None:
    """Delete all import log entries."""
    _ensure_dir()
    init_import_logs_table()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("DELETE FROM import_logs")
    conn.commit()
    conn.close()


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
