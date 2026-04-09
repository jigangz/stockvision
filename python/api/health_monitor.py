"""
API Health Monitor — tracks data source errors and exposes status to frontend.

When AKShare (or any adapter) fails, errors are recorded here.
The frontend polls /api/health/status and shows a toast notification
when errors exceed a threshold.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from fastapi import APIRouter

router = APIRouter(prefix="/api/health", tags=["health-monitor"])


@dataclass
class _ErrorRecord:
    message: str
    timestamp: float
    source: str = "akshare"


@dataclass
class _HealthState:
    """In-memory health state (resets on restart, which is fine)."""
    errors: list[_ErrorRecord] = field(default_factory=list)
    last_success: float | None = None
    consecutive_failures: int = 0
    # Keep at most 20 recent errors
    MAX_ERRORS: int = 20

    def add_error(self, msg: str, source: str = "akshare") -> None:
        self.errors.append(_ErrorRecord(message=msg, timestamp=time.time(), source=source))
        if len(self.errors) > self.MAX_ERRORS:
            self.errors = self.errors[-self.MAX_ERRORS:]
        self.consecutive_failures += 1

    def add_success(self) -> None:
        self.last_success = time.time()
        self.consecutive_failures = 0

    def clear(self) -> None:
        self.errors.clear()
        self.consecutive_failures = 0


_state = _HealthState()


# --- Public API for other modules to call ---

def record_api_error(msg: str, source: str = "akshare") -> None:
    _state.add_error(msg, source)


def record_api_success() -> None:
    _state.add_success()


# --- HTTP endpoints ---

@router.get("/status")
def get_health_status():
    """
    Frontend polls this to decide whether to show a warning toast.

    Returns:
        healthy: bool — false if consecutive_failures >= 2
        consecutive_failures: int
        last_error: str | null
        last_error_time: float | null (unix timestamp)
        last_success: float | null
    """
    last_err = _state.errors[-1] if _state.errors else None
    return {
        "healthy": _state.consecutive_failures < 2,
        "consecutive_failures": _state.consecutive_failures,
        "last_error": last_err.message if last_err else None,
        "last_error_time": last_err.timestamp if last_err else None,
        "last_error_source": last_err.source if last_err else None,
        "last_success": _state.last_success,
    }


@router.get("/errors")
def get_recent_errors():
    """Return recent error log for debugging."""
    return {
        "errors": [
            {"message": e.message, "timestamp": e.timestamp, "source": e.source}
            for e in _state.errors
        ]
    }


@router.post("/clear")
def clear_errors():
    """Clear error state (user dismissed the warning)."""
    _state.clear()
    return {"ok": True}
