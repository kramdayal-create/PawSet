# Mobile App Security Scanner

A self-contained **static** security scanner for mobile app binaries — **Android
`.apk`** and **iOS `.ipa`** — with a web dashboard and a CLI. It analyzes a
binary you upload and reports security issues mapped to **OWASP MASVS** and the
**OWASP Mobile Top 10 (2024)**.

> ⚠️ **Authorized use only.** Only analyze apps you **own** or have **written
> permission** to test. Reverse-engineering or testing third-party apps without
> authorization may violate their terms of service and local law (e.g. computer-
> misuse / cybercrime statutes). The web UI requires you to confirm authorization
> before each scan. This tool performs **static** analysis only — it does **not**
> attack, probe, or connect to any running app or server.

## What it checks

| Area | Android (APK) | iOS (IPA) |
|------|---------------|-----------|
| **Build / config** | debuggable, allowBackup, testOnly, old min/target SDK | debug entitlement (`get-task-allow`), dev/ad-hoc profile, low min OS |
| **Signing / integrity** | unsigned, v1-only signing, Android debug cert | — |
| **Network** | cleartext traffic, Network Security Config (user CAs, cleartext) | ATS disabled / per-domain exceptions, weak TLS |
| **Platform** | exported activities/services/receivers/**providers**, weak custom permissions, task-hijack hints | custom URL schemes |
| **Binary hardening** | — | PIE/ASLR, FairPlay encryption, stack canary, ARC (Mach-O) |
| **Storage / privacy** | world-readable modes, external storage, sensitive permissions | file sharing, keychain accessibility, privacy usage |
| **Crypto (heuristic)** | DES/3DES/RC4, AES-ECB, MD5/SHA-1, insecure RNG | ECB, weak RNG |
| **Secrets** | AWS/Google/Stripe/Slack/GitHub keys, JWTs, private keys, high-entropy generics across DEX + resources | same, across Info.plist / binary strings / bundled files |
| **Dependencies** | third-party SDK inventory (network/ads/analytics/payment…) + advisory notes | — |

Findings carry a severity, an evidence snippet (secrets are **redacted**), a
remediation, and MASVS / OWASP references. The report produces a **0–100 risk
score** and an **A–F grade**.

### Honest about limits
- Heuristic findings (string/indicator-based) are labelled `heuristic` —
  presence of an indicator is not proof the insecure path is reachable.
- Dependency detection reports **presence**, not versions. It does **not**
  fabricate CVE IDs; it points you to [OSV.dev](https://osv.dev) /
  [NVD](https://nvd.nist.gov) to check the exact version from your build files.
  `dependencies.osv_lookup()` can query OSV live when you supply a coordinate+version.
- No dynamic/runtime testing (DAST). `.aab` bundles and FairPlay-encrypted App
  Store binaries are not supported for deep analysis.
- Static analysis finding nothing is **not** proof an app is secure.

## Quick start

```bash
cd mobile-sec-scanner
./run.sh                      # creates a venv, installs deps, serves the dashboard
# → open http://127.0.0.1:8000
```

Or manually:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.server:app --reload
```

### CLI (good for CI)

```bash
python -m app.cli path/to/app.apk                 # human-readable report
python -m app.cli path/to/app.ipa --json out.json # machine-readable report
python -m app.cli path/to/app.apk --fail-on high  # exit 2 if any High+ finding
```

### Library

```python
from app.analyzer import scan_file
report = scan_file("app.ipa")
print(report.to_dict()["summary"])     # {'risk_score': ..., 'grade': ..., ...}
```

## Project layout

```
mobile-sec-scanner/
├── app/
│   ├── server.py            # FastAPI: dashboard + /api/scan (authorization-gated)
│   ├── cli.py               # command-line scanner
│   ├── analyzer/
│   │   ├── core.py          # platform detection + orchestration
│   │   ├── apk.py           # Android analysis (pyaxmlparser)
│   │   ├── ipa.py           # iOS analysis (plist + Mach-O)
│   │   ├── macho.py         # minimal Mach-O hardening parser
│   │   ├── secrets_scan.py  # credential detection (+ entropy gating + redaction)
│   │   ├── code_heuristics.py
│   │   ├── dependencies.py  # SDK inventory + optional OSV lookup
│   │   ├── strings_util.py  # binary string extraction + entropy
│   │   └── models.py        # Finding/Report/scoring model
│   └── static/              # dashboard UI (vanilla HTML/CSS/JS)
└── tests/                   # unit + end-to-end tests (synthetic fixtures)
```

## Tests

```bash
python -m pytest tests/ -q
```

Tests use a **synthetic, deliberately-vulnerable** IPA built in-process
(`tests/fixtures.py`) and a hand-built Android manifest — no real third-party
binary is downloaded or shipped.

## Relationship to existing tools

For production mobile pentesting, [MobSF (Mobile Security Framework)](https://github.com/MobSF/Mobile-Security-Framework-MobSF)
is the mature, full-featured open-source platform (it also adds dynamic
analysis). This project is a focused, dependency-light scanner you can embed,
read end-to-end, and run in CI.
