"""String/indicator-based code smells.

These run over strings extracted from DEX (Android) or the Mach-O binary
(iOS). They are heuristic: a matching indicator means the symbol/string is
present in the binary, not proof the insecure path is reachable. Findings are
therefore marked confidence="tentative".
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .models import Category, Finding, Severity


@dataclass(frozen=True)
class CodeRule:
    id: str
    title: str
    severity: Severity
    category: Category
    indicators: tuple[str, ...]      # substrings to look for (case-sensitive)
    description: str
    recommendation: str
    masvs: str | None = None
    owasp_mobile: str | None = None
    platforms: tuple[str, ...] = ("android", "ios")


RULES: tuple[CodeRule, ...] = (
    CodeRule(
        "WEAK_CRYPTO_DES", "Weak/broken cipher (DES/3DES/RC4)", Severity.HIGH,
        Category.CRYPTO, ("DES/", "DESede", "RC4", "ARC4"),
        "Indicators of DES, 3DES or RC4 usage were found. These ciphers are "
        "considered broken or weak for confidentiality.",
        "Use AES-256-GCM (or ChaCha20-Poly1305) with a vetted KDF.",
        masvs="MASVS-CRYPTO-1", owasp_mobile="M10",
    ),
    CodeRule(
        "WEAK_CRYPTO_ECB", "AES in ECB mode", Severity.MEDIUM, Category.CRYPTO,
        ("AES/ECB", "/ECB/",),
        "ECB mode leaks plaintext structure (identical blocks encrypt identically).",
        "Use an authenticated mode such as AES/GCM; never ECB.",
        masvs="MASVS-CRYPTO-1", owasp_mobile="M10",
    ),
    CodeRule(
        "WEAK_HASH", "Weak hash (MD5/SHA-1)", Severity.LOW, Category.CRYPTO,
        ("MD5", "SHA-1", "SHA1",),
        "MD5/SHA-1 indicators found. These are unsuitable for signatures, "
        "password hashing or integrity against an adversary.",
        "Use SHA-256+ for integrity and Argon2id/scrypt/PBKDF2 for passwords.",
        masvs="MASVS-CRYPTO-1", owasp_mobile="M10",
    ),
    CodeRule(
        "INSECURE_RANDOM", "Insecure randomness (java.util.Random)", Severity.LOW,
        Category.CRYPTO, ("java/util/Random", "java.util.Random"),
        "java.util.Random is predictable and must not seed security tokens/keys.",
        "Use java.security.SecureRandom for any security-relevant value.",
        masvs="MASVS-CRYPTO-2", owasp_mobile="M10", platforms=("android",),
    ),
    CodeRule(
        "TRUST_ALL_TLS", "Disabled/trust-all TLS validation", Severity.HIGH,
        Category.NETWORK,
        ("ALLOW_ALL_HOSTNAME_VERIFIER", "AllowAllHostnameVerifier",
         "NullHostnameVerifier", "TrustAllX509TrustManager", "trustAllCerts"),
        "Indicators of disabled certificate/hostname validation were found, "
        "which enables man-in-the-middle attacks.",
        "Never disable validation. Implement certificate pinning correctly.",
        masvs="MASVS-NETWORK-1", owasp_mobile="M3",
    ),
    CodeRule(
        "WEBVIEW_JS_BRIDGE", "WebView JavaScript bridge", Severity.MEDIUM,
        Category.PLATFORM,
        ("addJavascriptInterface",),
        "addJavascriptInterface exposes native methods to web content; on "
        "attacker-influenced content this can lead to code execution.",
        "Avoid JS bridges on untrusted content; restrict @JavascriptInterface, "
        "require API 17+, and load only trusted, https content.",
        masvs="MASVS-PLATFORM-2", owasp_mobile="M4", platforms=("android",),
    ),
    CodeRule(
        "WEBVIEW_FILE_ACCESS", "WebView file/content access enabled", Severity.MEDIUM,
        Category.PLATFORM,
        ("setAllowFileAccessFromFileURLs", "setAllowUniversalAccessFromFileURLs",
         "setAllowContentAccess"),
        "WebView settings that broaden file/universal access widen the attack "
        "surface for local file exfiltration via loaded web content.",
        "Disable these settings unless strictly required.",
        masvs="MASVS-PLATFORM-2", owasp_mobile="M4", platforms=("android",),
    ),
    CodeRule(
        "DYNAMIC_CODE_LOAD", "Dynamic code loading", Severity.MEDIUM, Category.CODE,
        ("DexClassLoader", "PathClassLoader", "loadLibrary\u0000",),
        "Dynamic/dex class loading can be abused to run unverified code and "
        "complicates integrity guarantees.",
        "Avoid loading external DEX; verify integrity of any loaded code.",
        masvs="MASVS-CODE-2", owasp_mobile="M9", platforms=("android",),
    ),
    CodeRule(
        "SENSITIVE_LOGGING", "Verbose logging present", Severity.LOW, Category.PRIVACY,
        ("Landroid/util/Log;", "android/util/Log"),
        "Logging APIs are referenced. If they emit tokens, PII or crypto "
        "material, those can be read via logcat on rooted/old devices.",
        "Strip debug logging in release builds (e.g. ProGuard/R8 rules).",
        masvs="MASVS-PRIVACY-3", owasp_mobile="M6", platforms=("android",),
    ),
    CodeRule(
        "SQL_RAW", "Raw SQL query construction", Severity.LOW, Category.CODE,
        ("rawQuery", "execSQL"),
        "Raw SQL indicators found. If user input is concatenated into these, "
        "local SQL injection is possible.",
        "Use parameterized queries / Room with bound parameters.",
        masvs="MASVS-CODE-4", owasp_mobile="M4", platforms=("android",),
    ),
    CodeRule(
        "EXTERNAL_STORAGE", "External storage usage", Severity.LOW, Category.STORAGE,
        ("getExternalStorageDirectory", "getExternalFilesDir",
         "MODE_WORLD_READABLE", "MODE_WORLD_WRITEABLE"),
        "World-readable/writable modes or external storage usage can expose "
        "sensitive files to other apps.",
        "Store sensitive data in app-internal storage; use EncryptedFile/"
        "Keystore. Never use world-readable/writable modes.",
        masvs="MASVS-STORAGE-1", owasp_mobile="M9", platforms=("android",),
    ),
    CodeRule(
        "IOS_INSECURE_RANDOM", "Insecure randomness (rand/srand)", Severity.LOW,
        Category.CRYPTO, ("_random\u0000", "_srand\u0000", "_arc4random\u0000"),
        "C rand()/srand() indicators found. arc4random is fine; rand()/srand() "
        "are predictable and must not generate secrets.",
        "Use SecRandomCopyBytes / arc4random_buf for security-relevant values.",
        masvs="MASVS-CRYPTO-2", owasp_mobile="M10", platforms=("ios",),
    ),
    CodeRule(
        "IOS_WEAK_KEYCHAIN", "Keychain without device-only protection", Severity.LOW,
        Category.STORAGE,
        ("kSecAttrAccessibleAlways", "kSecAttrAccessibleAlwaysThisDeviceOnly"),
        "Keychain items marked 'Always' accessible are readable even when the "
        "device is locked.",
        "Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly or stricter.",
        masvs="MASVS-STORAGE-1", owasp_mobile="M9", platforms=("ios",),
    ),
)


def _any_indicator(rule: CodeRule, blob: str) -> list[str]:
    hits = []
    for ind in rule.indicators:
        # Null terminators are a convenience for matching symbol boundaries;
        # strip them for the actual containment test.
        needle = ind.replace("\u0000", "")
        if needle and needle in blob:
            hits.append(ind.replace("\u0000", ""))
    return hits


def run(strings_blob: str, platform: str, location: str) -> list[Finding]:
    """`strings_blob` is a single joined string of all extracted strings."""
    findings: list[Finding] = []
    for rule in RULES:
        if platform not in rule.platforms:
            continue
        matched = _any_indicator(rule, strings_blob)
        if not matched:
            continue
        findings.append(Finding(
            id=rule.id,
            title=rule.title,
            severity=rule.severity,
            category=rule.category,
            description=rule.description,
            recommendation=rule.recommendation,
            evidence=[f"indicator: {m}" for m in sorted(set(matched))],
            location=location,
            masvs=rule.masvs,
            owasp_mobile=rule.owasp_mobile,
            confidence="tentative",
        ))
    return findings
