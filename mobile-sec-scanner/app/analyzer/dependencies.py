"""Third-party SDK / dependency inventory.

APK binaries rarely embed reliable dependency versions, so this module does
NOT invent CVE identifiers or claim a specific vulnerable version. It:
  * detects the *presence* of common third-party SDKs by package signature,
  * categorises them (analytics, ads, crash, network, payment, ...),
  * attaches a security/privacy advisory note, and
  * provides an OPTIONAL live OSV.dev lookup you can call when you *do* know a
    Maven coordinate + version (e.g. from the app's build files).

This keeps results accurate: "library X is present, verify its version against
OSV/NVD" rather than a fabricated finding.
"""
from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass

from .models import Category, Finding, Severity


@dataclass(frozen=True)
class SdkSignature:
    name: str
    package_prefix: str      # DEX class path form, e.g. "Lcom/squareup/okhttp"
    kind: str                # network | analytics | ads | crash | social | payment | webview | other
    note: str


# Package prefixes are in DEX descriptor form ("L" + slash path).
SDK_SIGNATURES: tuple[SdkSignature, ...] = (
    SdkSignature("OkHttp", "Lokhttp3/", "network",
                 "HTTP client. Verify >= a patched release and that TLS/pinning is configured."),
    SdkSignature("Retrofit", "Lretrofit2/", "network",
                 "REST client built on OkHttp; inherits its TLS configuration."),
    SdkSignature("Apache Cordova", "Lorg/apache/cordova/", "webview",
                 "Hybrid WebView framework; review whitelist/CSP and plugin exposure."),
    SdkSignature("Firebase", "Lcom/google/firebase/", "analytics",
                 "Check Firebase security rules and that no admin keys are embedded."),
    SdkSignature("Google Play Services", "Lcom/google/android/gms/", "other",
                 "Keep bundled Play Services libraries current."),
    SdkSignature("Facebook SDK", "Lcom/facebook/", "social",
                 "Collects data; confirm privacy disclosure and app secret handling."),
    SdkSignature("Crashlytics", "Lcom/crashlytics/", "crash",
                 "Ensure crash reports do not capture PII/secrets."),
    SdkSignature("Google Ads / AdMob", "Lcom/google/ads/", "ads",
                 "Ad SDKs expand network/privacy surface; review consent handling."),
    SdkSignature("AppsFlyer", "Lcom/appsflyer/", "analytics",
                 "Attribution SDK; review data collected and consent."),
    SdkSignature("Braze", "Lcom/appboy/", "analytics",
                 "Marketing SDK; review PII sent off-device."),
    SdkSignature("Stripe", "Lcom/stripe/android/", "payment",
                 "Payment SDK; ensure only publishable keys are client-side, never secret keys."),
    SdkSignature("PayPal", "Lcom/paypal/", "payment",
                 "Payment SDK; confirm no server credentials embedded in the client."),
    SdkSignature("Realm", "Lio/realm/", "other",
                 "Local DB; verify encryption key handling."),
    SdkSignature("SQLCipher", "Lnet/sqlcipher/", "other",
                 "Encrypted SQLite; verify the key is not hardcoded."),
    SdkSignature("Bouncy Castle", "Lorg/bouncycastle/", "other",
                 "Crypto provider; keep current and use vetted algorithms."),
    SdkSignature("Flutter", "Lio/flutter/", "other",
                 "Cross-platform runtime; scan the embedded Dart/engine too."),
    SdkSignature("React Native", "Lcom/facebook/react/", "webview",
                 "JS runtime; the JS bundle (index.android.bundle) should also be scanned."),
    SdkSignature("Unity", "Lcom/unity3d/", "other",
                 "Game engine; native libs (il2cpp) warrant separate review."),
)


def inventory(dex_strings_blob: str) -> list[SdkSignature]:
    found = [s for s in SDK_SIGNATURES if s.package_prefix in dex_strings_blob]
    return found


def to_findings(found: list[SdkSignature]) -> list[Finding]:
    findings: list[Finding] = []
    for sdk in found:
        sev = Severity.LOW if sdk.kind in ("payment", "ads", "analytics", "social") else Severity.INFO
        findings.append(Finding(
            id=f"DEP_{sdk.name.upper().replace(' ', '_').replace('/', '_')}",
            title=f"Third-party SDK present: {sdk.name}",
            severity=sev,
            category=Category.DEPENDENCY,
            description=f"Detected {sdk.name} ({sdk.kind}). {sdk.note}",
            recommendation=(
                "Confirm the exact version from your build files and check it "
                "against OSV.dev / NVD for known CVEs. Remove unused SDKs to "
                "reduce attack surface and data sharing."
            ),
            evidence=[f"package signature: {sdk.package_prefix}"],
            masvs="MASVS-CODE-3",
            owasp_mobile="M2",
            references=["https://osv.dev", "https://owasp.org/www-project-mobile-top-10/"],
            confidence="firm",
        ))
    return findings


def osv_lookup(ecosystem: str, package: str, version: str, timeout: float = 10.0) -> list[dict]:
    """Optional live OSV.dev query for a *known* package+version.

    ecosystem: e.g. "Maven", "npm", "PyPI". package: e.g. "com.squareup.okhttp3:okhttp".
    Returns the raw list of vuln records (may be empty). Network required.
    """
    payload = json.dumps({
        "version": version,
        "package": {"name": package, "ecosystem": ecosystem},
    }).encode()
    req = urllib.request.Request(
        "https://api.osv.dev/v1/query", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (trusted host)
        data = json.loads(resp.read().decode())
    return data.get("vulns", []) or []
