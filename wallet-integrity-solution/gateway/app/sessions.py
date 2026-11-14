"""Session / signing-key management.

DEMO simplification: `/session` mints a random per-session HMAC key and returns
it to the client. In production this key would be derived via an authenticated
key-agreement bound to a logged-in, attested device — never returned in
plaintext. The gateway-side verification logic (signing.py) is unchanged.
"""
from __future__ import annotations

import secrets

from .db import get_conn, tx
from .errors import AuthError
from .util import new_id, now_iso


def create_session(user_id: str) -> dict:
    session_id = new_id("sess")
    signing_key = secrets.token_hex(32)
    with tx() as conn:
        conn.execute(
            "INSERT INTO sessions(session_id, user_id, signing_key, created_at) VALUES(?,?,?,?)",
            (session_id, user_id, signing_key, now_iso()),
        )
    return {"session_id": session_id, "user_id": user_id, "signing_key": signing_key}


def load_session(session_id: str | None):
    if not session_id:
        raise AuthError("missing session id")
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id=?", (session_id,)
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise AuthError("unknown session")
    return row
