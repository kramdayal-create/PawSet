"""SQLite storage + transaction helper.

The gateway owns a single transaction boundary per request (BEGIN IMMEDIATE),
so signature/nonce checks, idempotency, and ledger posting all commit atomically
or not at all. That atomicity is what makes replay and double-spend races safe.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get(
    "WALLET_DB", os.path.join(os.path.dirname(__file__), "..", "wallet.db")
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts(
  id    TEXT PRIMARY KEY,
  kind  TEXT NOT NULL,              -- 'wallet' | 'funding'
  owner TEXT
);

-- Append-only. A balance is SUM(amount_minor); never stored as a mutable field.
CREATE TABLE IF NOT EXISTS ledger_entries(
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id      TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,    -- signed: +credit, -debit
  funding_ref TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_txn ON ledger_entries(txn_id);

-- Proof that value legitimately entered the system. A wallet credit must point
-- at one of these; the client can never create one.
CREATE TABLE IF NOT EXISTS funding_events(
  funding_ref   TEXT PRIMARY KEY,
  source        TEXT NOT NULL,      -- 'processor' | 'voucher'
  amount_minor  INTEGER NOT NULL,
  user_id       TEXT NOT NULL,
  status        TEXT NOT NULL,      -- 'verified'
  consumed      INTEGER NOT NULL DEFAULT 0,
  processor_idem TEXT UNIQUE,       -- processor settlement id (dedupe)
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vouchers(
  code        TEXT PRIMARY KEY,
  amount_minor INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'unused',  -- 'unused' | 'claimed'
  claimed_by  TEXT,
  claimed_at  TEXT
);

CREATE TABLE IF NOT EXISTS used_nonces(
  nonce      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys(
  key           TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions(
  session_id  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  signing_key TEXT NOT NULL,        -- hex; per-session HMAC key
  created_at  TEXT NOT NULL
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


@contextmanager
def tx(immediate: bool = True):
    """Atomic transaction scope. Commits on success, rolls back on any error."""
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
        yield conn
        conn.execute("COMMIT")
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        conn.close()


def init_db(reset: bool = False) -> None:
    conn = get_conn()
    try:
        if reset:
            for t in ("ledger_entries", "accounts", "funding_events", "vouchers",
                      "used_nonces", "idempotency_keys", "sessions"):
                conn.execute(f"DROP TABLE IF EXISTS {t}")
        conn.executescript(SCHEMA)
    finally:
        conn.close()
