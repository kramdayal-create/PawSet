"""Server-authoritative double-entry ledger (controls C1, C2 enforcement point).

Invariants enforced here — none of which depend on the client behaving:

  1. Every transaction BALANCES: the signed amounts of its entries sum to zero.
     => value cannot be created; a credit always has an equal debit.
  2. A debit against a `funding:*` account (i.e. money ENTERING the system) is
     only allowed when backed by a VERIFIED, UNCONSUMED funding_event of equal
     amount, which is then consumed. => no wallet credit without proven funding.
  3. A wallet cannot go negative (no overdraft / no spending money you don't have).

A balance is always SUM(amount_minor) over immutable entries — never a stored,
client-influenced number.
"""
from __future__ import annotations

import sqlite3

from .errors import FundingError, LedgerError
from .util import now_iso


def account_kind(account_id: str) -> str:
    return "funding" if account_id.startswith("funding:") else "wallet"


def ensure_account(conn: sqlite3.Connection, account_id: str, owner: str | None = None) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO accounts(id, kind, owner) VALUES(?,?,?)",
        (account_id, account_kind(account_id), owner),
    )


def balance(conn: sqlite3.Connection, account_id: str) -> int:
    row = conn.execute(
        "SELECT COALESCE(SUM(amount_minor),0) AS b FROM ledger_entries WHERE account_id=?",
        (account_id,),
    ).fetchone()
    return int(row["b"])


def _consume_funding_event(conn: sqlite3.Connection, funding_ref: str | None, amount: int) -> None:
    if not funding_ref:
        raise FundingError("wallet credit requires a verified funding reference")
    fe = conn.execute(
        "SELECT * FROM funding_events WHERE funding_ref=?", (funding_ref,)
    ).fetchone()
    if fe is None:
        raise FundingError("unknown funding reference")
    if fe["status"] != "verified":
        raise FundingError("funding event is not verified")
    if fe["amount_minor"] != amount:
        raise FundingError("funding amount does not match credited amount")
    # Atomically consume: only succeeds if not already consumed (race-safe).
    cur = conn.execute(
        "UPDATE funding_events SET consumed=1 WHERE funding_ref=? AND consumed=0",
        (funding_ref,),
    )
    if cur.rowcount != 1:
        raise FundingError("funding event already consumed")


def post_transaction(
    conn: sqlite3.Connection,
    txn_id: str,
    entries: list[tuple[str, int]],
    funding_ref: str | None = None,
) -> None:
    """Post a balanced set of entries atomically. Caller provides the open tx."""
    if len(entries) < 2:
        raise LedgerError("a transaction needs at least two entries")
    if sum(amount for _, amount in entries) != 0:
        raise LedgerError("transaction does not balance (entries must sum to zero)")

    for account_id, amount in entries:
        if amount == 0:
            raise LedgerError("zero-amount entry not allowed")
        ensure_account(conn, account_id)
        kind = account_kind(account_id)

        # Money entering the system: debit a funding account => must be verified.
        if kind == "funding" and amount < 0:
            _consume_funding_event(conn, funding_ref, -amount)

        # Spending from a wallet must not overdraw it.
        if kind == "wallet" and amount < 0:
            if balance(conn, account_id) + amount < 0:
                raise LedgerError("insufficient wallet balance")

    for account_id, amount in entries:
        conn.execute(
            "INSERT INTO ledger_entries(txn_id, account_id, amount_minor, funding_ref, created_at) "
            "VALUES(?,?,?,?,?)",
            (txn_id, account_id, amount, funding_ref, now_iso()),
        )


def all_balances(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute(
        "SELECT account_id, SUM(amount_minor) AS b FROM ledger_entries GROUP BY account_id"
    ).fetchall()
    return {r["account_id"]: int(r["b"]) for r in rows}
