from fastapi import APIRouter
from pydantic import BaseModel

from data.storage import save_config, load_all_config

router = APIRouter()


class ConfigValue(BaseModel):
    value: str


@router.get("/api/config")
def get_all_config() -> dict[str, str]:
    return load_all_config()


@router.put("/api/config/{key}")
def set_config(key: str, body: ConfigValue) -> dict[str, str]:
    save_config(key, body.value)
    return {"key": key, "value": body.value}
