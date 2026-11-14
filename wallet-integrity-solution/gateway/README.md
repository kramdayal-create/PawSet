# Wallet Integrity Gateway (reference implementation)

A small, runnable reference of the defensive control layer from
[`../SOLUTION-DESIGN.md`](../SOLUTION-DESIGN.md). It demonstrates how to make
**client-side wallet top-up / balance-inflation fraud structurally impossible**
— on a throwaway demo wallet, with nothing external involved.

It implements controls **C1–C4** (plus a reconciliation check, C8):

| Control | Here |
|--------|------|
| **C1 — server-authoritative double-entry ledger** | `app/ledger.py` — balances are `SUM(entries)`, every txn sums to zero |
| **C2 — verified funding only** | `app/funding.py` — credits require a processor webhook (HMAC-verified) or an atomically-claimed voucher |
| **C3 — request signing + replay protection** | `app/signing.py` — per-session HMAC over method/path/body/ts/nonce; nonces single-use |
| **C4 — idempotency** | `app/idempotency.py` — each money op runs at most once |
| **C8 — reconciliation** | `app/reconcile.py` — proves the books balance (conservation) |

The key property: **there is no endpoint that credits a wallet from a
client-supplied amount or status.** Value can only enter via a verified
settlement webhook or a voucher redemption, and the double-entry ledger makes
"money from nowhere" arithmetically impossible.

## Run it

```bash
cd gateway
./run.sh test     # run the test suite (12 tests)
./run.sh demo     # run the attack demonstration (prints the story below)
./run.sh serve    # serve the API on http://127.0.0.1:8000
```

(`run.sh` creates a venv on first use. You can also run directly with the deps
in `requirements.txt`: `python -m pytest tests/`, `python demo/attack_demo.py`.)

## What the demo shows

1. **Legitimate funding** — a voucher redemption and a card top-up settled via a
   signed processor webhook. Balances go up, each backed by a verified funding event.
2. **Every client-side fraud attempt is refused:**
   - self-credit via a fake/unknown funding reference → **blocked** (no verified funding)
   - forged processor webhook (no secret) → **blocked** (bad HMAC)
   - replay of a captured signed request → **blocked** (nonce reused)
   - tampering the amount on a signed request → **blocked** (signature mismatch)
   - 8 concurrent redemptions of one voucher → **exactly one succeeds** (atomic claim)
   - replayed settlement id → **deduplicated** (credited once)
   - overdraft transfer → **blocked** (insufficient funds)
3. **Reconciliation** — the sum of all accounts is exactly R0.00 (double-entry
   conservation) and total wallet balances equal total verified funding → **no
   unfunded value was created.**

## API surface

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /session` | — (demo) | mint a session + per-session signing key |
| `POST /webhooks/processor` | processor HMAC | record a verified settlement (server-to-server) |
| `POST /wallet/redeem` | signed + idempotent | redeem a voucher |
| `POST /wallet/transfer` | signed + idempotent | transfer between wallets |
| `GET  /wallet/balance` | signed | server-computed balance |
| `GET  /admin/reconcile` | — (demo) | reconciliation report |

## Scope & honesty

This is a **reference of the control layer**, deliberately compact:

- Demo simplifications are commented where they occur: `/session` returns the
  signing key in plaintext (production uses authenticated key-agreement bound to
  an attested device), secrets are hard-coded defaults, storage is SQLite, and
  there is no real payment processor — the webhook is signed with a shared demo
  secret to simulate the server-to-server confirmation.
- It implements C1–C4 + reconciliation. **Device/app attestation (C5), transport
  pinning (C6), step-up auth & velocity limits (C7), and the full anomaly engine
  (C8)** are described in the solution design and are the natural next build-out.
- It is a *defensive* demonstration on a self-contained wallet. It is not, and
  must not be pointed at, any third-party system.
