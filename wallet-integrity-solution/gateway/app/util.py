"""Small shared helpers."""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone


def now_unix() -> int:
    return int(time.time())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"
