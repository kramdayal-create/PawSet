"""Configuration and demo secrets.

NOTE: these are DEMO values. In production, secrets come from a secret manager,
the processor webhook secret is shared only between the processor and the
gateway (never the app), and per-session signing keys are established via an
authenticated key-agreement at login — not returned in plaintext like the demo
`/session` endpoint does.
"""
from __future__ import annotations

import os

# Shared ONLY between the payment processor and the gateway. The mobile client
# never has this — which is why a client cannot forge a settlement webhook.
PROCESSOR_WEBHOOK_SECRET = os.environ.get(
    "PROCESSOR_WEBHOOK_SECRET", "demo-processor-secret-do-not-use-in-prod"
)

# How far a signed request's timestamp may drift (seconds) before it is stale.
SIGNING_WINDOW_SECONDS = int(os.environ.get("SIGNING_WINDOW_SECONDS", "300"))

CURRENCY = "ZAR"

# System (internal) ledger accounts money flows through.
ACCT_FUNDING_PROCESSOR = "funding:processor"
ACCT_FUNDING_VOUCHER = "funding:voucher"
