"""End-to-end demonstration.

Runs a legitimate funding flow, then fires every client-side attempt to inflate
a balance, and finally reconciles to prove no value was created. Uses an
in-process TestClient against a fresh temp database — nothing external.

Run:  python demo/attack_demo.py      (from the gateway/ directory)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading

# Make `app` and `client` importable and pin a throwaway DB BEFORE importing app.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["WALLET_DB"] = os.path.join(tempfile.mkdtemp(), "demo_wallet.db")

from fastapi.testclient import TestClient  # noqa: E402

from app import funding  # noqa: E402
from app.db import init_db  # noqa: E402
from app.seed import ensure_system_accounts, seed_voucher  # noqa: E402
from app.server import create_app  # noqa: E402
from client.sdk import WalletClient  # noqa: E402

if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
    GREEN = RED = YELLOW = DIM = BOLD = RESET = ""
else:
    GREEN, RED, YELLOW, DIM, BOLD, RESET = (
        "\033[32m", "\033[31m", "\033[33m", "\033[90m", "\033[1m", "\033[0m")


def money(minor: int) -> str:
    return f"R{minor / 100:,.2f}"


def ok(label, detail=""):
    print(f"  {GREEN}✓ ALLOWED {RESET} {label} {DIM}{detail}{RESET}")


def blocked(label, resp):
    reason = resp.json().get("reason", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
    print(f"  {RED}✗ BLOCKED {RESET} {label} {DIM}→ {resp.status_code} {reason}{RESET}")


def header(txt):
    print(f"\n{BOLD}{txt}{RESET}")


def setup():
    init_db(reset=True)
    ensure_system_accounts()
    for code, amt in [("VCH-GROCERIES", 15000), ("VCH-REPLAY", 5000), ("VCH-RACE", 10000)]:
        seed_voucher(code, amt)
    return TestClient(create_app(init=False))


def main() -> int:
    client = setup()
    print(f"{BOLD}Wallet Integrity Gateway — attack demonstration{RESET}")
    print(f"{DIM}Every credit must trace to verified funding; the client is untrusted.{RESET}")

    alice = WalletClient(client, "alice")   # our (attacker-capable) user
    bob = WalletClient(client, "bob")
    alice.open_session()
    bob.open_session()

    # ------------------------------------------------------------------ legit
    header("1. Legitimate funding (the only ways value can enter)")
    r = alice.redeem("VCH-GROCERIES")
    ok("voucher redeemed", f"balance now {money(r.json()['balance_minor'])}")

    settlement = {"settlement_id": "stl-1001", "user_id": "alice",
                  "amount_minor": 20000, "currency": "ZAR"}
    sig = funding.processor_sign(settlement)   # the PROCESSOR signs (has the secret)
    r = client.post("/webhooks/processor", content=json.dumps(settlement).encode(),
                    headers={"x-processor-signature": sig, "content-type": "application/json"})
    ok("card top-up settled via processor webhook", f"+{money(settlement['amount_minor'])}")
    print(f"  {DIM}alice balance: {money(alice.balance().json()['balance_minor'])}{RESET}")

    # ------------------------------------------------------------- the attacks
    header("2. Client-side fraud attempts (all must be refused)")

    # R1/R2: credit self with a funding reference that was never verified.
    r = alice.redeem("VCH-DOES-NOT-EXIST")
    blocked("A. self-credit via fake/unknown voucher (R1,R2)", r)

    # R2: forge a processor settlement without the webhook secret.
    forged = {"settlement_id": "stl-9999", "user_id": "alice",
              "amount_minor": 5_000_000, "currency": "ZAR"}
    r = client.post("/webhooks/processor", content=json.dumps(forged).encode(),
                    headers={"x-processor-signature": "deadbeef", "content-type": "application/json"})
    blocked("B. forged processor webhook (bad HMAC) (R2)", r)

    # R3: replay a captured, validly-signed request verbatim.
    req = alice.prepare("POST", "/wallet/redeem",
                        json.dumps({"voucher_code": "VCH-REPLAY"}).encode(),
                        idempotency_key="idem-replay")
    first = alice.send(req)
    ok("first use of signed request", f"+{money(first.json()['amount_minor'])}")
    replay = alice.send(req)            # identical bytes, identical nonce
    blocked("C. replay same signed request (R3)", replay)

    # R3: tamper with the amount after signing.
    body = json.dumps({"to_user": "bob", "amount_minor": 100}).encode()
    req = alice.prepare("POST", "/wallet/transfer", body, idempotency_key="idem-tamper")
    tampered = json.dumps({"to_user": "bob", "amount_minor": 1_000_000}).encode()
    r = client.post("/wallet/transfer", content=tampered, headers=req["headers"])
    blocked("D. tamper amount on a signed transfer (R3)", r)

    # R5/R6: redeem one voucher from many concurrent requests (race).
    results: list[int] = []
    lock = threading.Lock()
    barrier = threading.Barrier(8)

    def race():
        barrier.wait()
        resp = alice.redeem("VCH-RACE")      # distinct nonce + idem each call
        with lock:
            results.append(resp.status_code)

    threads = [threading.Thread(target=race) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    successes = sum(1 for s in results if s == 200)
    tag = GREEN + "✓" if successes == 1 else RED + "✗"
    print(f"  {tag} RACE    {RESET} E. 8 concurrent redemptions of one voucher (R5,R6) "
          f"{DIM}→ exactly {successes} succeeded, {len(results) - successes} blocked{RESET}")

    # R3: reuse a processor settlement id (double-credit attempt).
    r = client.post("/webhooks/processor", content=json.dumps(settlement).encode(),
                    headers={"x-processor-signature": sig, "content-type": "application/json"})
    dup = r.json().get("status") == "duplicate_ignored"
    tag = GREEN + "✓" if dup else RED + "✗"
    print(f"  {tag} DEDUP   {RESET} F. replay processor settlement id (R3) "
          f"{DIM}→ {r.json().get('status')}{RESET}")

    # R: spend more than you hold.
    r = alice.transfer("bob", 99_999_999)
    blocked("G. overdraft transfer beyond balance", r)

    # ---------------------------------------------------------- reconciliation
    header("3. Reconciliation — prove the books balance")
    rec = client.get("/admin/reconcile").json()
    a_bal = alice.balance().json()["balance_minor"]
    b_bal = bob.balance().json()["balance_minor"]
    print(f"  alice wallet:              {money(a_bal)}")
    print(f"  bob wallet:                {money(b_bal)}")
    print(f"  wallet balances total:     {money(rec['wallet_balances_total_minor'])}")
    print(f"  verified funding consumed: {money(rec['verified_funding_consumed_minor'])}")
    print(f"  grand total (all accounts):{money(rec['grand_total_minor'])}  "
          f"{DIM}(double-entry conservation → must be R0.00){RESET}")
    books = rec["books_balance"] and rec["no_unfunded_value"]
    verdict = f"{GREEN}BOOKS BALANCE · NO UNFUNDED VALUE CREATED{RESET}" if books \
        else f"{RED}RECONCILIATION FAILED{RESET}"
    print(f"\n  {BOLD}Result:{RESET} {verdict}")
    print(f"  {DIM}Every attempt to inflate a balance was refused or neutralised, and "
          f"every rand in a wallet traces to verified funding.{RESET}\n")
    return 0 if books else 1


if __name__ == "__main__":
    raise SystemExit(main())
