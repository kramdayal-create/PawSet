"""Idempotency keys (control C4).

Each money operation carries a client-generated idempotency key. The gateway
executes a given key at most once and returns the stored result for any retry,
so retries and replays can never multiply a credit or transfer.
"""
from __future__ import annotations

import json
import sqlite3

from .util import now_iso


def lookup(conn: sqlite3.Connection, key: str) -> dict | None:
    row = conn.execute(
        "SELECT response_json FROM idempotency_keys WHERE key=?", (key,)
    ).fetchone()
    return json.loads(row["response_json"]) if row else None


def store(conn: sqlite3.Connection, key: str, result: dict) -> None:
    conn.execute(
        "INSERT INTO idempotency_keys(key, response_json, created_at) VALUES(?,?,?)",
        (key, json.dumps(result), now_iso()),
    )
