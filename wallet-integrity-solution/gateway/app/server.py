"""Wallet Integrity Gateway — FastAPI app.

Endpoints:
  POST /session                 (demo) mint a session + signing key
  POST /webhooks/processor      processor settlement (HMAC-verified, server-to-server)
  POST /wallet/redeem           signed+idempotent: redeem a voucher
  POST /wallet/transfer         signed+idempotent: transfer between wallets
  GET  /wallet/balance          signed: server-computed balance
  GET  /admin/reconcile         (demo) prove the books balance

There is deliberately NO endpoint that credits a wallet from a client-supplied
amount or status. Value enters only via /webhooks/processor or voucher redemption.
"""
from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import funding, idempotency, ledger, reconcile, signing
from .config import CURRENCY
from .db import init_db, tx
from .errors import DomainError, ValidationError
from .seed import ensure_system_accounts
from .sessions import create_session, load_session
from .util import new_id


def create_app(init: bool = True) -> FastAPI:
    app = FastAPI(title="Wallet Integrity Gateway", version="1.0.0")

    if init:
        init_db(reset=False)
        ensure_system_accounts()

    @app.exception_handler(DomainError)
    async def _domain_error(_request: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status,
            content={"blocked": True, "code": exc.code, "reason": exc.reason},
        )

    # ---- session (demo) --------------------------------------------------
    @app.post("/session")
    async def session(request: Request):
        body = json.loads((await request.body()).decode() or "{}")
        user_id = body.get("user_id")
        if not user_id:
            raise ValidationError("user_id required")
        return create_session(user_id)

    # ---- processor settlement webhook (server-to-server) -----------------
    @app.post("/webhooks/processor")
    async def processor_webhook(request: Request):
        payload = json.loads((await request.body()).decode() or "{}")
        signature = request.headers.get("x-processor-signature")
        return funding.record_settlement(payload, signature)

    # ---- signed money operations ----------------------------------------
    @app.post("/wallet/redeem")
    async def redeem(request: Request):
        return await _handle_signed(request, _op_redeem)

    @app.post("/wallet/transfer")
    async def transfer(request: Request):
        return await _handle_signed(request, _op_transfer)

    @app.get("/wallet/balance")
    async def balance(request: Request):
        session_row = load_session(request.headers.get("x-session-id"))
        user_id = session_row["user_id"]
        with tx() as conn:
            signing.verify_request(conn, session_row, "GET", "/wallet/balance",
                                   b"", request.headers)
            bal = ledger.balance(conn, f"wallet:{user_id}")
        return {"user_id": user_id, "balance_minor": bal, "currency": CURRENCY}

    # ---- reconciliation (demo) ------------------------------------------
    @app.get("/admin/reconcile")
    async def admin_reconcile():
        with tx() as conn:
            return reconcile.reconcile(conn)

    return app


# ---- shared signed-operation handler -------------------------------------
async def _handle_signed(request: Request, op_fn):
    raw = await request.body()
    session_row = load_session(request.headers.get("x-session-id"))
    idem_key = request.headers.get("x-idempotency-key")
    if not idem_key:
        raise ValidationError("missing x-idempotency-key")

    with tx() as conn:
        # C3: verify signature + timestamp window + nonce (replay) — this also
        # records the nonce so an identical captured request is rejected.
        signing.verify_request(conn, session_row, request.method,
                               request.url.path, raw, request.headers)
        # C4: idempotency — a repeated key returns the first result, never re-runs.
        cached = idempotency.lookup(conn, idem_key)
        if cached is not None:
            return {**cached, "idempotent_replay": True}

        body = json.loads(raw.decode() or "{}")
        result = op_fn(conn, session_row["user_id"], body)
        idempotency.store(conn, idem_key, result)
        return result


def _op_redeem(conn, user_id: str, body: dict) -> dict:
    code = body.get("voucher_code")
    if not code:
        raise ValidationError("voucher_code required")
    amount, funding_ref = funding.claim_voucher(conn, code, user_id)
    return {
        "status": "redeemed",
        "amount_minor": amount,
        "funding_ref": funding_ref,
        "balance_minor": ledger.balance(conn, f"wallet:{user_id}"),
    }


def _op_transfer(conn, user_id: str, body: dict) -> dict:
    to_user = body.get("to_user")
    amount = body.get("amount_minor")
    if not to_user:
        raise ValidationError("to_user required")
    if not isinstance(amount, int) or amount <= 0:
        raise ValidationError("amount_minor must be a positive integer")
    if to_user == user_id:
        raise ValidationError("cannot transfer to self")
    txn_id = new_id("txn")
    ledger.post_transaction(
        conn, txn_id,
        [(f"wallet:{user_id}", -amount), (f"wallet:{to_user}", amount)],
    )
    return {
        "status": "transferred",
        "amount_minor": amount,
        "to_user": to_user,
        "balance_minor": ledger.balance(conn, f"wallet:{user_id}"),
    }


# Module-level app for `uvicorn app.server:app`.
app = create_app()
