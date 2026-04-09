import json

from fastapi import APIRouter
from pydantic import BaseModel

from data.storage import save_config, load_config, load_all_config

router = APIRouter()

_WATCHLIST_KEY = "watchlist"


class ConfigValue(BaseModel):
    value: str


class WatchlistBody(BaseModel):
    codes: list[str]


@router.get("/api/config")
def get_all_config() -> dict[str, str]:
    return load_all_config()


# Static watchlist routes must be registered BEFORE the dynamic {key} route
@router.get("/api/config/watchlist")
def get_watchlist() -> list[str]:
    raw = load_config(_WATCHLIST_KEY)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


@router.put("/api/config/watchlist")
def put_watchlist(body: WatchlistBody) -> dict:
    save_config(_WATCHLIST_KEY, json.dumps(body.codes))
    return {"codes": body.codes}


@router.put("/api/config/{key}")
def set_config(key: str, body: ConfigValue) -> dict[str, str]:
    save_config(key, body.value)
    return {"key": key, "value": body.value}
