"""Verified funding (control C2): the ONLY ways value legitimately enters a wallet.

  * Processor settlement webhook — verified server-to-server by HMAC signature,
    deduplicated by the processor's settlement id. The mobile client cannot forge
    this because it does not hold the processor webhook secret.
  * Voucher redemption — claimed atomically (single UPDATE guarded by status),
    so a code can be redeemed at most once even under concurrent requests.

Both produce a `funding_event` the ledger then consumes exactly once.
"""
from __future__ import annotations

import hashlib
import hmac
import sqlite3

from . import ledger
from .config import ACCT_FUNDING_PROCESSOR, ACCT_FUNDING_VOUCHER, PROCESSOR_WEBHOOK_SECRET
from .db import tx
from .errors import FundingError, ValidationError
from .util import new_id, now_iso


# ---- processor settlement webhook ----------------------------------------
def processor_canonical(payload: dict) -> bytes:
    return "\n".join([
        str(payload.get("settlement_id", "")),
        str(payload.get("user_id", "")),
        str(payload.get("amount_minor", "")),
        str(payload.get("currency", "")),
    ]).encode()


def processor_sign(payload: dict) -> str:
    return hmac.new(
        PROCESSOR_WEBHOOK_SECRET.encode(), processor_canonical(payload), hashlib.sha256
    ).hexdigest()


def record_settlement(payload: dict, signature: str) -> dict:
    """Handle a settlement webhook. Opens its own transaction."""
    expected = processor_sign(payload)
    if not (signature and hmac.compare_digest(expected, signature)):
        raise FundingError("invalid processor webhook signature")

    settlement_id = str(payload.get("settlement_id") or "")
    user_id = str(payload.get("user_id") or "")
    amount = payload.get("amount_minor")
    if not settlement_id or not user_id or not isinstance(amount, int) or amount <= 0:
        raise ValidationError("malformed settlement payload")

    funding_ref = f"set_{settlement_id}"
    with tx() as conn:
        # Dedupe on the processor's settlement id (idempotent webhooks).
        existing = conn.execute(
            "SELECT 1 FROM funding_events WHERE processor_idem=?", (settlement_id,)
        ).fetchone()
        if existing:
            return {"status": "duplicate_ignored", "settlement_id": settlement_id}

        conn.execute(
            "INSERT INTO funding_events(funding_ref, source, amount_minor, user_id, "
            "status, consumed, processor_idem, created_at) VALUES(?,?,?,?,?,?,?,?)",
            (funding_ref, "processor", amount, user_id, "verified", 0, settlement_id, now_iso()),
        )
        txn_id = new_id("txn")
        ledger.post_transaction(
            conn, txn_id,
            [(ACCT_FUNDING_PROCESSOR, -amount), (f"wallet:{user_id}", amount)],
            funding_ref=funding_ref,
        )
    return {"status": "settled", "amount_minor": amount, "user_id": user_id,
            "funding_ref": funding_ref}


# ---- voucher redemption (runs inside the caller's transaction) ------------
def claim_voucher(conn: sqlite3.Connection, code: str, user_id: str) -> tuple[int, str]:
    """Atomically claim a voucher; returns (amount_minor, funding_ref).

    The conditional UPDATE is the whole race defence: exactly one caller can flip
    a voucher from 'unused' to 'claimed'.
    """
    cur = conn.execute(
        "UPDATE vouchers SET status='claimed', claimed_by=?, claimed_at=? "
        "WHERE code=? AND status='unused'",
        (user_id, now_iso(), code),
    )
    if cur.rowcount != 1:
        raise FundingError("voucher invalid or already claimed")

    row = conn.execute("SELECT amount_minor FROM vouchers WHERE code=?", (code,)).fetchone()
    amount = int(row["amount_minor"])
    funding_ref = new_id("vch")
    conn.execute(
        "INSERT INTO funding_events(funding_ref, source, amount_minor, user_id, "
        "status, consumed, processor_idem, created_at) VALUES(?,?,?,?,?,?,?,?)",
        (funding_ref, "voucher", amount, user_id, "verified", 0, None, now_iso()),
    )
    txn_id = new_id("txn")
    ledger.post_transaction(
        conn, txn_id,
        [(ACCT_FUNDING_VOUCHER, -amount), (f"wallet:{user_id}", amount)],
        funding_ref=funding_ref,
    )
    return amount, funding_ref
