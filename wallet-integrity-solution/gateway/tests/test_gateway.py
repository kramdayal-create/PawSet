"""Tests for the Wallet Integrity Gateway (controls C1–C4 + reconciliation)."""
from __future__ import annotations

import json
import threading

import pytest
from fastapi.testclient import TestClient

from app import funding
from app.db import init_db
from app.seed import ensure_system_accounts, seed_voucher
from app.server import create_app
from client.sdk import WalletClient


@pytest.fixture()
def gw():
    init_db(reset=True)
    ensure_system_accounts()
    for code, amt in [("V100", 10000), ("V50", 5000), ("VRACE", 7000), ("VIDEM", 3000)]:
        seed_voucher(code, amt)
    return TestClient(create_app(init=False))


def _alice(gw) -> WalletClient:
    a = WalletClient(gw, "alice")
    a.open_session()
    return a


def settle(gw, settlement_id, user, amount):
    payload = {"settlement_id": settlement_id, "user_id": user,
               "amount_minor": amount, "currency": "ZAR"}
    sig = funding.processor_sign(payload)
    return gw.post("/webhooks/processor", content=json.dumps(payload).encode(),
                   headers={"x-processor-signature": sig, "content-type": "application/json"})


# --- C1/C2: value enters only via verified funding -------------------------
def test_voucher_redeem_credits_wallet(gw):
    alice = _alice(gw)
    r = alice.redeem("V100")
    assert r.status_code == 200
    assert r.json()["balance_minor"] == 10000
    assert alice.balance().json()["balance_minor"] == 10000


def test_processor_settlement_credits_wallet(gw):
    alice = _alice(gw)
    assert settle(gw, "s1", "alice", 20000).json()["status"] == "settled"
    assert alice.balance().json()["balance_minor"] == 20000


def test_unknown_voucher_is_rejected(gw):
    alice = _alice(gw)
    r = alice.redeem("NOPE")
    assert r.status_code == 422          # no verified funding => blocked
    assert alice.balance().json()["balance_minor"] == 0


def test_forged_webhook_rejected(gw):
    alice = _alice(gw)
    payload = {"settlement_id": "x", "user_id": "alice", "amount_minor": 999999, "currency": "ZAR"}
    r = gw.post("/webhooks/processor", content=json.dumps(payload).encode(),
                headers={"x-processor-signature": "bad", "content-type": "application/json"})
    assert r.status_code == 422
    assert alice.balance().json()["balance_minor"] == 0


def test_duplicate_settlement_credits_once(gw):
    alice = _alice(gw)
    settle(gw, "dup", "alice", 15000)
    r2 = settle(gw, "dup", "alice", 15000)
    assert r2.json()["status"] == "duplicate_ignored"
    assert alice.balance().json()["balance_minor"] == 15000


# --- C3: signing / replay / tamper -----------------------------------------
def test_replay_blocked(gw):
    alice = _alice(gw)
    req = alice.prepare("POST", "/wallet/redeem",
                        json.dumps({"voucher_code": "V50"}).encode(),
                        idempotency_key="k1")
    assert alice.send(req).status_code == 200
    replay = alice.send(req)             # identical nonce
    assert replay.status_code == 401
    assert "replay" in replay.json()["reason"].lower()


def test_tampered_amount_blocked(gw):
    alice = _alice(gw)
    body = json.dumps({"to_user": "bob", "amount_minor": 100}).encode()
    req = alice.prepare("POST", "/wallet/transfer", body, idempotency_key="k2")
    tampered = json.dumps({"to_user": "bob", "amount_minor": 1_000_000}).encode()
    r = gw.post("/wallet/transfer", content=tampered, headers=req["headers"])
    assert r.status_code == 401          # signature covers the body


def test_bad_session_rejected(gw):
    r = gw.get("/wallet/balance", headers={"x-session-id": "sess_nope",
                                           "x-timestamp": "0", "x-nonce": "n", "x-signature": "s"})
    assert r.status_code == 401


# --- C4: idempotency --------------------------------------------------------
def test_idempotent_retry_credits_once(gw):
    alice = _alice(gw)
    r1 = alice.redeem("VIDEM", idempotency_key="same-key")
    r2 = alice.redeem("VIDEM", idempotency_key="same-key")   # new nonce, same idem key
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r2.json().get("idempotent_replay") is True
    assert alice.balance().json()["balance_minor"] == 3000   # credited once, not twice


# --- C1: no overdraft, transfers conserve ----------------------------------
def test_transfer_and_overdraft(gw):
    alice = _alice(gw)
    bob = WalletClient(gw, "bob")
    bob.open_session()
    alice.redeem("V100")                 # 10000
    assert alice.transfer("bob", 4000).status_code == 200
    assert alice.balance().json()["balance_minor"] == 6000
    assert bob.balance().json()["balance_minor"] == 4000
    over = alice.transfer("bob", 99_999_999)
    assert over.status_code == 422       # insufficient funds


# --- C5/race: single-use voucher under concurrency -------------------------
def test_concurrent_voucher_redeem_single_success(gw):
    alice = _alice(gw)
    results: list[int] = []
    lock = threading.Lock()
    barrier = threading.Barrier(8)

    def race():
        barrier.wait()
        resp = alice.redeem("VRACE")
        with lock:
            results.append(resp.status_code)

    ts = [threading.Thread(target=race) for _ in range(8)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    assert sum(1 for s in results if s == 200) == 1
    assert alice.balance().json()["balance_minor"] == 7000


# --- reconciliation ---------------------------------------------------------
def test_reconciliation_balances(gw):
    alice = _alice(gw)
    bob = WalletClient(gw, "bob")
    bob.open_session()
    alice.redeem("V100")
    settle(gw, "r1", "alice", 20000)
    alice.transfer("bob", 5000)
    alice.redeem("NOPE")                 # blocked, creates nothing
    rec = gw.get("/admin/reconcile").json()
    assert rec["books_balance"] is True
    assert rec["no_unfunded_value"] is True
    assert rec["grand_total_minor"] == 0
    # wallets total == external funding in (10000 + 20000)
    assert rec["wallet_balances_total_minor"] == 30000
    assert rec["verified_funding_consumed_minor"] == 30000
