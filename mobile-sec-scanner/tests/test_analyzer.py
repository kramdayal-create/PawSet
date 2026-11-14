"""Tests for the mobile security analyzer.

Covers unit behaviour of each detector plus an end-to-end IPA scan built from
a synthetic vulnerable fixture, and the Android manifest rules driven by a
hand-built manifest tree (so no real APK binary is required).
"""
from __future__ import annotations

import os

from lxml import etree

from app.analyzer import apk as apk_mod
from app.analyzer import code_heuristics, dependencies, macho, secrets_scan
from app.analyzer.core import detect_platform, scan_file
from app.analyzer.models import AppInfo, Report
from app.analyzer.strings_util import looks_like_secret, shannon_entropy
from tests.fixtures import build_macho_arm64, build_vulnerable_ipa

NS = "http://schemas.android.com/apk/res/android"


def _a(key: str) -> str:
    return f"{{{NS}}}{key}"


# --------------------------------------------------------------------------
# strings / entropy
# --------------------------------------------------------------------------
def test_entropy_and_secret_heuristic():
    assert shannon_entropy("aaaaaaaa") < 1.0
    assert shannon_entropy("A1b2C3d4E5f6G7h8") > 3.0
    assert looks_like_secret("A1b2C3d4E5f6G7h8X9")       # mixed, long
    assert not looks_like_secret("short")                 # too short
    assert not looks_like_secret("implementation")        # dictionary-ish lower


# --------------------------------------------------------------------------
# secrets scanner
# --------------------------------------------------------------------------
def test_secret_patterns():
    blob = (
        b"AKIAIOSFODNN7EXAMPLE "
        b"sk_live_ABCDEFGH1234567890abcd "
        b"-----BEGIN RSA PRIVATE KEY----- "
        b"AIza" + b"B" * 35
    )
    hits = secrets_scan.scan_bytes(blob, "test")
    ids = {h["rule_id"] for h in hits}
    assert "AWS_ACCESS_KEY" in ids
    assert "STRIPE_LIVE" in ids
    assert "PRIVATE_KEY" in ids
    assert "GOOGLE_API_KEY" in ids
    # values should be redacted, not echoed verbatim (except key header line)
    stripe = next(h for h in hits if h["rule_id"] == "STRIPE_LIVE")
    assert "1234567890abcd" not in stripe["match"]


def test_generic_secret_entropy_gate():
    # Low-entropy value should NOT be flagged.
    low = secrets_scan.scan_bytes(b'password = "password12345"', "x")
    assert not any(h["rule_id"] == "GENERIC_SECRET" for h in low)
    # High-entropy value should be flagged.
    high = secrets_scan.scan_bytes(b'api_key = "a9F3kZ1qP0wX7bN2"', "x")
    assert any(h["rule_id"] == "GENERIC_SECRET" for h in high)


# --------------------------------------------------------------------------
# mach-o
# --------------------------------------------------------------------------
def test_macho_parse():
    data = build_macho_arm64(b"_objc_release\x00padding")
    info = macho.parse(data)
    assert info.is_macho
    assert "arm64" in info.archs
    assert info.pie is False          # header flag not set
    assert info.encrypted is False    # cryptid 0
    assert info.has_arc is True
    assert info.has_stack_canary is False


# --------------------------------------------------------------------------
# code heuristics + dependencies
# --------------------------------------------------------------------------
def test_code_heuristics_android():
    blob = "Ljava/util/Random; AES/ECB/NoPadding addJavascriptInterface Landroid/util/Log;"
    findings = code_heuristics.run(blob, "android", "classes.dex")
    ids = {f.id for f in findings}
    assert "INSECURE_RANDOM" in ids
    assert "WEAK_CRYPTO_ECB" in ids
    assert "WEBVIEW_JS_BRIDGE" in ids


def test_dependency_inventory():
    blob = "Lokhttp3/OkHttpClient; Lcom/stripe/android/Stripe; Lcom/google/firebase/X;"
    found = dependencies.inventory(blob)
    names = {s.name for s in found}
    assert {"OkHttp", "Stripe", "Firebase"} <= names
    findings = dependencies.to_findings(found)
    assert any(f.id == "DEP_STRIPE" for f in findings)


# --------------------------------------------------------------------------
# end-to-end IPA scan
# --------------------------------------------------------------------------
def test_ipa_end_to_end(tmp_path):
    ipa_path = str(tmp_path / "vuln.ipa")
    build_vulnerable_ipa(ipa_path)

    assert detect_platform(ipa_path) == "ios"
    report = scan_file(ipa_path)
    data = report.to_dict()
    ids = {f["id"] for f in data["findings"]}

    # Platform / config
    assert "IOS_ATS_ARBITRARY_LOADS" in ids
    assert "IOS_FILE_SHARING" in ids
    assert "IOS_GET_TASK_ALLOW" in ids
    assert "IOS_CUSTOM_URL_SCHEMES" in ids
    assert "IOS_LOW_MIN_OS" in ids
    # Binary hardening
    assert "IOS_NO_PIE" in ids
    # Secrets (from exe strings and/or config.json)
    assert any(i.startswith("SECRET_") for i in ids)
    # Metadata resolved
    assert report.app.package == "com.example.vulnapp"
    assert report.app.platform == "ios"
    # A vulnerable app should not grade A.
    assert data["summary"]["grade"] in {"C", "D", "F"}
    assert data["summary"]["risk_score"] > 0


# --------------------------------------------------------------------------
# android manifest rules (driven by a synthetic manifest tree)
# --------------------------------------------------------------------------
def _build_manifest():
    manifest = etree.Element("manifest")
    manifest.set(_a("versionCode"), "1")
    appel = etree.SubElement(manifest, "application")
    appel.set(_a("debuggable"), "true")
    appel.set(_a("allowBackup"), "true")
    appel.set(_a("usesCleartextTraffic"), "true")

    # Exported, unguarded content provider -> HIGH
    prov = etree.SubElement(appel, "provider")
    prov.set(_a("name"), ".SecretProvider")
    prov.set(_a("exported"), "true")

    # Exported service via implicit intent-filter, no permission -> MEDIUM
    svc = etree.SubElement(appel, "service")
    svc.set(_a("name"), ".ExportedSvc")
    sfil = etree.SubElement(svc, "intent-filter")
    sact = etree.SubElement(sfil, "action")
    sact.set(_a("name"), "com.example.ACTION")

    # Launcher activity -> should NOT be flagged as exported vuln
    act = etree.SubElement(appel, "activity")
    act.set(_a("name"), ".Main")
    ifil = etree.SubElement(act, "intent-filter")
    a1 = etree.SubElement(ifil, "action")
    a1.set(_a("name"), "android.intent.action.MAIN")
    c1 = etree.SubElement(ifil, "category")
    c1.set(_a("name"), "android.intent.category.LAUNCHER")

    up = etree.SubElement(manifest, "uses-permission")
    up.set(_a("name"), "android.permission.READ_SMS")
    return manifest


def test_android_manifest_rules():
    manifest = _build_manifest()
    app = AppInfo(platform="android", file_name="x.apk", file_size=1, sha256="0",
                  min_sdk="19", target_sdk="26")
    report = Report(app=app)
    apk_mod._check_application_flags(manifest, app, report)
    apk_mod._check_components(manifest, app, report)
    apk_mod._check_permissions(manifest, report)
    apk_mod._check_sdk_versions(app, report)

    ids = {f.id for f in report.findings}
    assert "ANDROID_DEBUGGABLE" in ids
    assert "ANDROID_ALLOW_BACKUP" in ids
    assert "ANDROID_CLEARTEXT" in ids
    assert "ANDROID_EXPORTED_PROVIDER" in ids
    assert "ANDROID_EXPORTED_SERVICE" in ids
    assert "ANDROID_SENSITIVE_PERMS" in ids
    assert "ANDROID_LOW_MIN_SDK" in ids
    assert "ANDROID_LOW_TARGET_SDK" in ids

    # The launcher activity must not be reported as an exported-component vuln.
    assert "ANDROID_EXPORTED_ACTIVITY" not in ids

    # Provider (unguarded) must be HIGH severity.
    prov = next(f for f in report.findings if f.id == "ANDROID_EXPORTED_PROVIDER")
    assert prov.severity.value == "high"


def test_detect_platform_unknown(tmp_path):
    p = tmp_path / "not_an_app.txt"
    p.write_text("hello")
    assert detect_platform(str(p)) == "unknown"
