# Wallet Integrity: Preventing Client-Side Top-Up & Balance-Inflation Fraud

**A defensive architecture and product design for mobile payment/wallet platforms**

> Scope: this document addresses a *class* of fraud — a client being able to
> increase its own wallet balance (or "fund" a top-up) without a corresponding,
> verified movement of real money. It is vendor-neutral and contains no exploit
> details for, and no analysis of, any specific third-party application. It is a
> design for *defenders*.

---

## 1. Executive summary

**The problem.** In many mobile wallets, money-moving operations are partly
trusted to the client (the app on the user's phone). When the server treats a
client-supplied amount, a client-reported "payment succeeded" signal, or a
cached balance as authoritative, a modified client, a tampered network request,
or a replayed message can create value that was never actually paid for. Because
the mobile client runs on a device fully controlled by a potential attacker, it
**cannot be trusted** — ever.

**The solution.** A layered *wallet integrity* control set whose first principle
is: **the server is the single source of truth, and every unit of value entering
a wallet must be traceable to an independently verified funding event.** The
client is reduced to *requesting* operations; it can never *assert* outcomes.

**The business case.** Client-side top-up fraud scales per user and per day: once
a method is known, any user can repeat it, and losses compound daily until the
hole is closed. *(The operator's own loss-per-user-per-day figure should be used
in the business case; treat any external estimate as unverified until modelled
from real transaction data.)* A control layer that makes the exploit class
impossible pays for itself against even a handful of abusing accounts.

---

## 2. Threat model

### 2.1 Assets
- Wallet balances and the ledger that backs them.
- Funding instruments (cards, EFT, vouchers, airtime, rewards).
- The integrity of the money-in / money-out flows.

### 2.2 Attacker capabilities (assume all of these)
- Full control of their own device: root/jailbreak, repackaged app, hooking
  frameworks (e.g. Frida/Xposed), emulators.
- Full visibility and control of their own network traffic: they can read,
  modify, and replay any request/response (TLS does not stop the *endpoint owner*).
- A valid account and valid login — being an authenticated user is **not** a
  defence against this class of fraud.

### 2.3 Root-cause taxonomy (what actually goes wrong)
This is the heart of the design: every control below maps back to one of these.

| # | Root cause | Plain-English failure |
|---|-----------|------------------------|
| R1 | **Client-authoritative amount** | Server credits whatever amount the client says. |
| R2 | **Unverified funding signal** | Server credits on a client-reported "payment OK" instead of a server-to-server confirmation from the processor. |
| R3 | **Replay / no idempotency** | A legitimate credit request can be replayed N times for N credits. |
| R4 | **Mutable, trusted balance** | Balance is stored/cached as a number the client can influence or that the server reads back from the client. |
| R5 | **Single-use not enforced atomically** | Vouchers/promos redeemable more than once via races. |
| R6 | **Race / double-spend (TOCTOU)** | Concurrent requests both pass a check before either commits. |
| R7 | **IDOR / account confusion** | Request manipulated to credit the wrong (or a second) ledger. |
| R8 | **No device/app integrity** | Server can't tell a genuine app from a tampered one or a bot. |
| R9 | **Weak reconciliation** | Credits are never checked against what the processor actually settled, so fraud goes unnoticed. |

---

## 3. Design principles

1. **Zero client trust.** The client *requests*; the server *decides*. No
   amount, balance, status, or "success" from the client is ever authoritative.
2. **No value without verified funding.** Money can only enter a wallet from a
   funding event the server verified out-of-band (processor webhook, atomic
   voucher claim, or a real debit of another ledger).
3. **Server-authoritative ledger.** Balance is *derived*, not stored-and-trusted
   — the sum of immutable, double-entry ledger records.
4. **Every money operation is idempotent.** Exactly-once semantics by design.
5. **Defence in depth.** Device attestation, request signing, limits, and
   detection are layers, not single points of failure.
6. **Everything reconciles.** If the ledger and the processor disagree, that's an
   alert, automatically.

---

## 4. Reference architecture

```
                         ┌──────────────────────────────────────────────┐
                         │                MOBILE CLIENT                   │
                         │  (UNTRUSTED — requests operations only)        │
                         │                                                │
   Integrity SDK ───►    │  • request signing (per-session key)           │
                         │  • device/app attestation token                │
                         │  • cert pinning, tamper/root signals           │
                         └───────────────────────┬────────────────────────┘
                                                 │  signed request:
                                                 │  {op, params, nonce, ts,
                                                 │   idempotencyKey, attToken}
                                                 ▼
          ┌───────────────────────────────────────────────────────────────────┐
          │                 WALLET INTEGRITY GATEWAY (server)                   │
          │                                                                     │
          │  1. Verify request signature + timestamp window                     │
          │  2. Verify nonce unused  ──────────────► replay store (R3,R6)       │
          │  3. Verify attestation token ──────────► Play Integrity / App Attest│
          │  4. Idempotency: dedupe by idempotencyKey (R3)                      │
          │  5. Authorization + velocity/limit rules (R1,R5,R7)                 │
          │  6. NEVER credit on client amount/status — enforce funding proof    │
          └───────────────┬───────────────────────────────┬─────────────────────┘
                          │                               │
          money IN only via verified event:               │  read model
                          ▼                               ▼
   ┌───────────────────────────────────┐     ┌────────────────────────────────┐
   │  FUNDING VERIFIER                  │     │  DOUBLE-ENTRY LEDGER (truth)    │
   │  • processor webhook (HMAC + idem) │────►│  balance = Σ immutable entries  │
   │  • atomic single-use voucher claim │     │  credits require a funding ref  │
   │  • internal transfer (debits real  │     │  (R1,R2,R4)                     │
   │    ledger first)         (R2,R5)   │     └───────────────┬─────────────────┘
   └───────────────────────────────────┘                     │
                          ▲                                   ▼
                          │                   ┌────────────────────────────────┐
   ┌──────────────────────┴───────────┐       │  FRAUD DETECTION & RECON       │
   │  PAYMENT PROCESSOR / BANK         │       │  • credit vs settlement recon  │
   │  (authoritative on settlement)    │──────►│  • anomaly scoring, auto-hold  │
   └───────────────────────────────────┘       │  • clawback via reversing entry│
                                               │  (R9)                          │
                                               └────────────────────────────────┘
```

---

## 5. Control catalogue

Each control states **what**, **why**, **how**, and the **root causes** it closes.

### C1 — Server-authoritative double-entry ledger  *(R1, R4)*
- **What:** Balances are never a stored mutable field. Each movement is two
  immutable entries (debit one account, credit another). A balance is the sum of
  entries for an account.
- **Why:** The client can never submit, cache, or influence a balance. Reversals
  (clawbacks) are just new entries — clean and auditable.
- **How:** Append-only `ledger_entries` table; `balance(account)` is a computed
  read model (materialised + verifiable by re-summation). Credits require a
  non-null, unique `funding_ref`.

### C2 — Verified funding only  *(R2, R5)*
- **What:** A wallet credit is allowed **only** when backed by: (a) a processor
  settlement webhook verified server-to-server, (b) an atomically claimed
  single-use voucher, or (c) an internal transfer that first debited a real
  ledger.
- **Why:** Kills "client says payment succeeded → credit me." The client's
  opinion of payment status is irrelevant.
- **How:** Webhooks verified by HMAC signature + processor idempotency id;
  vouchers claimed with an atomic conditional update (`UPDATE ... WHERE
  status='unused'` / unique constraint) so a race can't double-redeem.

### C3 — Request signing + replay protection  *(R3, R6)*
- **What:** Every money-moving request carries a signature (HMAC over a canonical
  form of method+path+body+timestamp+nonce) using a per-session key established
  at login, plus a unique nonce and a tight timestamp window.
- **Why:** Stops tampering and replay of captured requests.
- **How:** Gateway recomputes the signature, rejects on mismatch, rejects stale
  timestamps, and rejects any previously-seen nonce (short-TTL store).

### C4 — Idempotency keys  *(R3)*
- **What:** Each money operation includes a client-generated idempotency key; the
  server executes it **at most once** and returns the same result on retries.
- **Why:** Retries and replays can't multiply credits.
- **How:** Unique index on `idempotency_key`; first write wins, duplicates return
  the stored outcome.

### C5 — Device & app attestation  *(R8)*
- **What:** High-risk operations require a fresh attestation token proving the
  request came from a genuine, unmodified app on a genuine device.
- **Why:** Raises the bar against repackaged apps, emulators, and bots.
- **How:** **Play Integrity API** (Android) and **App Attest / DeviceCheck**
  (iOS); tokens verified **server-side**. Treat failures as risk signals feeding
  C8, and block the highest-risk ops outright. (Attestation is a strong signal,
  not an absolute — that's why it's one layer.)

### C6 — Strong transport + pinning  *(supports R3)*
- **What:** TLS 1.2+ everywhere, certificate/public-key pinning in the SDK.
- **Why:** Raises cost of trivial MITM tampering. (Note: pinning does **not** stop
  the device owner, which is exactly why C1–C4 do the real work.)

### C7 — Authorization, step-up & velocity limits  *(R1, R5, R7)*
- **What:** Server-side rules: per-user and per-tier caps, velocity limits,
  new-account cooldowns, and step-up auth (PIN/biometric/OTP) for funding and
  transfers. All object references are authorization-checked server-side (no
  trusting a client-supplied account id).
- **Why:** Caps blast radius and closes IDOR/account-confusion.

### C8 — Real-time fraud detection + reconciliation  *(R9)*
- **What:** Continuously reconcile ledger credits against processor settlement
  reports; score transactions for anomalies (balance inflation with no matching
  settlement, impossible velocity, device/IP anomalies); auto-hold and alert.
- **Why:** Even if a novel bypass appears, discrepancies surface fast and value
  can be frozen/clawed back before cash-out.
- **How:** Scheduled reconciliation job; rules + ML scoring; case management;
  clawback via reversing ledger entries (C1).

### C9 — Immutable audit & response  *(cross-cutting)*
- **What:** Tamper-evident audit log of every decision; ability to freeze
  accounts and reverse fraudulent entries.
- **Why:** Forensics, dispute handling, and regulator/PCI evidence.

---

## 6. Control-to-root-cause coverage

| Root cause | Closed by |
|-----------|-----------|
| R1 client-authoritative amount | C1, C2, C7 |
| R2 unverified funding signal | C2 |
| R3 replay / no idempotency | C3, C4 |
| R4 mutable trusted balance | C1 |
| R5 single-use not atomic | C2, C7 |
| R6 race / double-spend | C3, C4, (C1 atomic commit) |
| R7 IDOR / account confusion | C7 |
| R8 no device/app integrity | C5, C6 |
| R9 weak reconciliation | C8, C9 |

Every root cause is covered by at least one control that does **not** depend on
the client behaving honestly.

---

## 7. Productising this (what you actually sell)

Three packaging options, in increasing value:

1. **Advisory + reference architecture** — this document, tailored, plus a threat
   model workshop. Lowest effort, fastest to offer.
2. **Wallet Integrity Gateway (software)** — a drop-in server-side service /
   middleware that enforces C3–C7 in front of an existing wallet backend, plus a
   lightweight **Integrity SDK** for the app (signing + attestation). This is the
   strongest standalone product: it slots in without rebuilding the core ledger.
3. **Full platform** — Gateway + SDK + the fraud-detection/reconciliation engine
   (C8) as a managed service with dashboards.

**Pitch framing (important):** sell it as prevention of a *class* of fraud and as
a control layer aligned to **PCI-DSS**, **OWASP MASVS**, and **OWASP Mobile Top
10 (M1/M3/M4)** — not as "I know how to break your app." Lead with the
architecture and the reconciliation guarantee; that's what a bank's security and
product teams can say yes to.

---

## 8. Phased roadmap

- **Phase 0 — Foundations:** server-authoritative double-entry ledger (C1);
  verified-funding rule (C2). *Closes R1, R2, R4 — the core of the exploit class.*
- **Phase 1 — Request integrity:** signing + replay + idempotency (C3, C4).
  *Closes R3, R6.*
- **Phase 2 — Device trust & limits:** attestation (C5), pinning (C6), authz &
  velocity (C7). *Closes R7, R8.*
- **Phase 3 — Detection & assurance:** reconciliation + anomaly engine (C8),
  audit/response (C9). *Closes R9, provides ongoing assurance.*

A credible demo can be built on Phases 0–1 alone, because that is where the
value-creation hole is actually closed.

---

## 9. How you prove it works (KPIs)

- **Unfunded-credit rate → 0:** every credit has a valid `funding_ref`; a
  reconciliation job proves ledger credits == processor settlements.
- **Replay/dedupe effectiveness:** duplicate idempotency keys and replayed nonces
  rejected (measurable in the gateway).
- **Attestation pass-rate** and blocked-op counts on high-risk flows.
- **Time-to-detect / time-to-freeze** for injected test anomalies (in *your* lab,
  on *your* demo wallet — never on a third party's system).

---

## 10. Standards alignment (for the pitch)

- **OWASP MASVS v2:** MASVS-NETWORK (secure comms), MASVS-AUTH (step-up),
  MASVS-CODE/RESILIENCE (attestation, anti-tamper), MASVS-STORAGE (no trusted
  client state).
- **OWASP Mobile Top 10 (2024):** M1 (improper credential/trust usage), M3
  (insecure communication), M4 (insufficient input/output validation).
- **PCI-DSS:** server-side validation, strong crypto, audit logging, monitoring.

---

### Build-it-next options
A working reference implementation of the **Wallet Integrity Gateway** (C1–C4) —
double-entry ledger, verified-funding rule, request-signing verification, and
idempotency — would make the pitch concrete and is fully buildable here, on a
demo wallet, with no third-party system involved.
