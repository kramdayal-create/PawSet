"""Demo seeding helpers (system accounts + test vouchers)."""
from __future__ import annotations

from .config import ACCT_FUNDING_PROCESSOR, ACCT_FUNDING_VOUCHER
from .db import tx


def ensure_system_accounts() -> None:
    with tx() as conn:
        for acct in (ACCT_FUNDING_PROCESSOR, ACCT_FUNDING_VOUCHER):
            conn.execute(
                "INSERT OR IGNORE INTO accounts(id, kind, owner) VALUES(?,?,?)",
                (acct, "funding", "system"),
            )


def seed_voucher(code: str, amount_minor: int) -> None:
    with tx() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO vouchers(code, amount_minor, status) VALUES(?,?, 'unused')",
            (code, amount_minor),
        )
