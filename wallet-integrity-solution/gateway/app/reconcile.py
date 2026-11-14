"""Reconciliation (control C8 preview): prove the books balance.

Because every transaction is balanced double-entry, the sum of ALL account
balances must be exactly zero at all times — value is never created. And the
total credited into wallets must equal the total of verified funding that was
consumed. If either identity breaks, something posted value without backing.
"""
from __future__ import annotations

import sqlite3

from . import ledger


def reconcile(conn: sqlite3.Connection) -> dict:
    balances = ledger.all_balances(conn)
    wallet_total = sum(v for k, v in balances.items() if k.startswith("wallet:"))
    funding_total = sum(v for k, v in balances.items() if k.startswith("funding:"))
    grand_total = sum(balances.values())

    row = conn.execute(
        "SELECT COALESCE(SUM(amount_minor),0) AS s FROM funding_events WHERE consumed=1"
    ).fetchone()
    consumed_funding = int(row["s"])

    books_balance = grand_total == 0
    funded_matches = (wallet_total == -funding_total == consumed_funding)

    return {
        "account_balances_minor": balances,
        "wallet_balances_total_minor": wallet_total,
        "funding_accounts_total_minor": funding_total,
        "grand_total_minor": grand_total,
        "verified_funding_consumed_minor": consumed_funding,
        "books_balance": books_balance,                 # conservation: must be True
        "no_unfunded_value": books_balance and funded_matches,
    }
