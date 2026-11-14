"""Reference Integrity SDK (client side of control C3/C4).

A well-behaved client: it opens a session, then signs every money request with
the per-session key and attaches a unique nonce + idempotency key. `prepare_*`
returns the request without sending it, so tests/demos can also show what
happens when a request is tampered with or replayed.

Works with any client exposing `.post(path, content=bytes, headers=dict)` and
`.get(path, headers=dict)` — e.g. fastapi.testclient.TestClient or httpx.Client.
"""
from __future__ import annotations

import json
import secrets

from app.signing import sign
from app.util import now_unix


class WalletClient:
    def __init__(self, http, user_id: str):
        self.http = http
        self.user_id = user_id
        self.session_id: str | None = None
        self.signing_key: str | None = None

    # ---- session ---------------------------------------------------------
    def open_session(self) -> dict:
        body = json.dumps({"user_id": self.user_id}).encode()
        r = self.http.post("/session", content=body,
                           headers={"content-type": "application/json"})
        d = r.json()
        self.session_id = d["session_id"]
        self.signing_key = d["signing_key"]
        return d

    # ---- request construction -------------------------------------------
    def prepare(self, method: str, path: str, body: bytes,
                idempotency_key: str | None = None,
                nonce: str | None = None, timestamp: str | None = None) -> dict:
        ts = timestamp or str(now_unix())
        nce = nonce or secrets.token_hex(12)
        sig = sign(self.signing_key, method, path, body, ts, nce)
        headers = {
            "x-session-id": self.session_id,
            "x-timestamp": ts,
            "x-nonce": nce,
            "x-signature": sig,
            "content-type": "application/json",
        }
        if idempotency_key is not None:
            headers["x-idempotency-key"] = idempotency_key
        return {"method": method, "path": path, "body": body, "headers": headers}

    def send(self, req: dict):
        if req["method"] == "GET":
            return self.http.get(req["path"], headers=req["headers"])
        return self.http.post(req["path"], content=req["body"], headers=req["headers"])

    # ---- high-level operations ------------------------------------------
    def redeem(self, voucher_code: str, idempotency_key: str | None = None):
        body = json.dumps({"voucher_code": voucher_code}).encode()
        req = self.prepare("POST", "/wallet/redeem", body,
                           idempotency_key or secrets.token_hex(8))
        return self.send(req)

    def transfer(self, to_user: str, amount_minor: int, idempotency_key: str | None = None):
        body = json.dumps({"to_user": to_user, "amount_minor": amount_minor}).encode()
        req = self.prepare("POST", "/wallet/transfer", body,
                           idempotency_key or secrets.token_hex(8))
        return self.send(req)

    def balance(self):
        req = self.prepare("GET", "/wallet/balance", b"")
        return self.send(req)
