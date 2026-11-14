"""Request signing + replay protection (control C3).

A money-moving request is signed with a per-session HMAC key over a canonical
form of (method, path, body-hash, timestamp, nonce). The gateway recomputes the
signature, enforces a timestamp window, and rejects any nonce it has seen before
— so a captured request can neither be tampered with nor replayed.
"""
from __future__ import annotations

import hashlib
import hmac
import sqlite3

from .config import SIGNING_WINDOW_SECONDS
from .errors import AuthError
from .util import now_iso, now_unix


def canonical_request(method: str, path: str, body: bytes, timestamp: str, nonce: str) -> bytes:
    body_hash = hashlib.sha256(body or b"").hexdigest()
    return "\n".join([method.upper(), path, body_hash, str(timestamp), nonce]).encode()


def sign(signing_key_hex: str, method: str, path: str, body: bytes,
         timestamp: str, nonce: str) -> str:
    key = bytes.fromhex(signing_key_hex)
    msg = canonical_request(method, path, body, timestamp, nonce)
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_request(conn: sqlite3.Connection, session: sqlite3.Row,
                   method: str, path: str, body: bytes, headers) -> None:
    timestamp = headers.get("x-timestamp")
    nonce = headers.get("x-nonce")
    signature = headers.get("x-signature")
    if not (timestamp and nonce and signature):
        raise AuthError("missing signing headers (x-timestamp/x-nonce/x-signature)")

    try:
        drift = abs(now_unix() - int(timestamp))
    except ValueError as e:
        raise AuthError("invalid timestamp") from e
    if drift > SIGNING_WINDOW_SECONDS:
        raise AuthError("stale request (timestamp outside allowed window)")

    expected = sign(session["signing_key"], method, path, body, timestamp, nonce)
    if not hmac.compare_digest(expected, signature):
        raise AuthError("bad request signature (tampering or wrong key)")

    # Replay protection: a nonce may be used exactly once.
    try:
        conn.execute(
            "INSERT INTO used_nonces(nonce, created_at) VALUES(?,?)", (nonce, now_iso())
        )
    except sqlite3.IntegrityError as e:
        raise AuthError("replay detected (nonce already used)") from e
