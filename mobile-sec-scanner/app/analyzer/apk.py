"""Android APK static analysis."""
from __future__ import annotations

import io
import zipfile

from . import code_heuristics, dependencies, secrets_scan
from .models import AppInfo, Category, Finding, Report, Severity
from .strings_util import iter_ascii_strings

ANDROID_NS = "http://schemas.android.com/apk/res/android"

# Permissions worth calling out when requested.
SENSITIVE_PERMISSIONS = {
    "android.permission.READ_SMS", "android.permission.SEND_SMS",
    "android.permission.RECEIVE_SMS", "android.permission.READ_CONTACTS",
    "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.RECORD_AUDIO", "android.permission.CAMERA",
    "android.permission.READ_CALL_LOG", "android.permission.WRITE_CALL_LOG",
    "android.permission.READ_PHONE_STATE", "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.SYSTEM_ALERT_WINDOW", "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.MANAGE_EXTERNAL_STORAGE", "android.permission.BLUETOOTH_CONNECT",
    "android.permission.READ_PHONE_NUMBERS", "android.permission.GET_ACCOUNTS",
}

# Files that are worth scanning as text for secrets (besides DEX/arsc).
_TEXT_EXT = (".xml", ".json", ".properties", ".js", ".txt", ".pem", ".key",
             ".cfg", ".yml", ".yaml", ".html", ".bundle", ".map")
_MAX_FILE_BYTES = 6 * 1024 * 1024
_MAX_STRINGS = 400_000


def _a(elem, name: str) -> str | None:
    return elem.get(f"{{{ANDROID_NS}}}{name}")


def analyze(path: str, app: AppInfo, report: Report) -> None:
    from pyaxmlparser import APK  # imported lazily so IPA-only use needs no apk deps

    try:
        apk = APK(path)
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"APK parse failed: {e}")
        return

    if not apk.is_valid_APK():
        report.errors.append("File does not parse as a valid APK.")
        return

    # ---- app metadata --------------------------------------------------
    app.package = apk.get_package()
    app.label = apk.get_app_name()
    app.version_name = apk.get_androidversion_name()
    app.version_code = str(apk.get_androidversion_code())
    app.min_sdk = _safe(apk.get_min_sdk_version)
    app.target_sdk = _safe(apk.get_target_sdk_version)
    app.extra["is_multidex"] = _safe(apk.is_multidex)

    manifest = None
    try:
        manifest = apk.get_android_manifest_xml()
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"Manifest decode failed: {e}")

    if manifest is not None:
        _check_application_flags(manifest, app, report)
        _check_components(manifest, app, report)
        _check_permissions(manifest, report)
        _check_network_security_config(apk, manifest, report)

    _check_signing(apk, path, report)
    _check_sdk_versions(app, report)

    # ---- content scans (DEX strings, resources, assets) ----------------
    dex_blob = _collect_dex_strings(apk, report)
    _secret_scan(apk, dex_blob, report)
    report.findings.extend(code_heuristics.run(dex_blob, "android", "classes.dex"))
    report.findings.extend(
        dependencies.to_findings(dependencies.inventory(dex_blob))
    )


def _safe(fn):
    try:
        v = fn()
        return str(v) if v is not None else None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Manifest checks
# ---------------------------------------------------------------------------
def _check_application_flags(manifest, app: AppInfo, report: Report) -> None:
    appel = manifest.find("application")
    if appel is None:
        return

    if _a(appel, "debuggable") == "true":
        report.add(Finding(
            "ANDROID_DEBUGGABLE", "Application is debuggable", Severity.HIGH,
            Category.CODE,
            "android:debuggable=\"true\" allows attaching a debugger and reading "
            "app memory/data on any device.",
            "Set android:debuggable=\"false\" (the default) for release builds.",
            evidence=["application android:debuggable=\"true\""],
            location="AndroidManifest.xml", masvs="MASVS-RESILIENCE-2",
            owasp_mobile="M8",
        ))

    backup = _a(appel, "allowBackup")
    target = _int(app.target_sdk)
    # Default allowBackup is true below API 31.
    if backup == "true" or (backup is None and (target is None or target < 31)):
        report.add(Finding(
            "ANDROID_ALLOW_BACKUP", "ADB/cloud backup allowed", Severity.MEDIUM,
            Category.STORAGE,
            "allowBackup is enabled (explicitly or by default), so app data can "
            "be extracted via `adb backup` or restored onto an attacker device.",
            "Set android:allowBackup=\"false\" or define a strict "
            "fullBackupContent/dataExtractionRules to exclude sensitive data.",
            evidence=[f"android:allowBackup={backup!r} (target SDK {app.target_sdk})"],
            location="AndroidManifest.xml", masvs="MASVS-STORAGE-2", owasp_mobile="M9",
        ))

    cleartext = _a(appel, "usesCleartextTraffic")
    if cleartext == "true":
        report.add(Finding(
            "ANDROID_CLEARTEXT", "Cleartext (HTTP) traffic permitted", Severity.HIGH,
            Category.NETWORK,
            "usesCleartextTraffic=\"true\" allows unencrypted HTTP, exposing data "
            "to interception and tampering.",
            "Remove the flag and use HTTPS only; enforce via a Network Security Config.",
            evidence=["application android:usesCleartextTraffic=\"true\""],
            location="AndroidManifest.xml", masvs="MASVS-NETWORK-1", owasp_mobile="M3",
        ))
    elif cleartext is None and target is not None and target < 28:
        report.add(Finding(
            "ANDROID_CLEARTEXT_DEFAULT", "Cleartext traffic allowed by default",
            Severity.MEDIUM, Category.NETWORK,
            f"targetSdkVersion {target} (<28) defaults to permitting cleartext HTTP "
            "when no Network Security Config forbids it.",
            "Target SDK 28+ and/or ship a Network Security Config that sets "
            "cleartextTrafficPermitted=\"false\".",
            evidence=[f"targetSdk={target}, no usesCleartextTraffic set"],
            location="AndroidManifest.xml", masvs="MASVS-NETWORK-1", owasp_mobile="M3",
        ))

    if _a(appel, "testOnly") == "true":
        report.add(Finding(
            "ANDROID_TESTONLY", "testOnly flag set", Severity.LOW, Category.CODE,
            "android:testOnly=\"true\" marks a non-production build.",
            "Remove testOnly for release builds.",
            location="AndroidManifest.xml", masvs="MASVS-RESILIENCE-2",
        ))


def _check_components(manifest, app: AppInfo, report: Report) -> None:
    appel = manifest.find("application")
    if appel is None:
        return
    target = _int(app.target_sdk)
    kinds = {"activity": "activity", "activity-alias": "activity",
             "service": "service", "receiver": "receiver", "provider": "provider"}
    exported_count = 0
    for child in appel:
        tag = child.tag if isinstance(child.tag, str) else None
        if tag not in kinds:
            continue
        name = _a(child, "name") or "(unnamed)"
        permission = _a(child, "permission")
        exported_attr = _a(child, "exported")
        intent_filters = child.findall("intent-filter")
        has_if = len(intent_filters) > 0
        is_launcher = _is_launcher(intent_filters)

        if exported_attr == "true":
            exported = True
        elif exported_attr == "false":
            exported = False
        else:
            # Implicit default: exported if it has an intent-filter (pre-31 rule).
            exported = has_if or (tag == "provider" and (target is None or target < 17))

        if not exported:
            continue
        exported_count += 1
        if is_launcher:
            continue  # the launcher activity is intentionally exported

        guarded = permission is not None
        if tag == "provider":
            sev = Severity.MEDIUM if guarded else Severity.HIGH
        else:
            sev = Severity.LOW if guarded else Severity.MEDIUM

        report.add(Finding(
            f"ANDROID_EXPORTED_{kinds[tag].upper()}",
            f"Exported {kinds[tag]} reachable by other apps",
            sev, Category.PLATFORM,
            f"The {kinds[tag]} '{name}' is exported"
            + (f" but guarded by permission '{permission}'." if guarded
               else " with no permission guard, so any installed app can invoke it.")
            + (" Content providers are especially sensitive (data access)."
               if tag == "provider" else ""),
            "Set android:exported=\"false\" if it need not be public, or protect it "
            "with a signature-level android:permission and validate all inbound Intents.",
            evidence=[
                f"<{tag}> name={name}",
                f"exported={exported_attr or '(implicit via intent-filter)'}",
                f"permission={permission or 'NONE'}",
            ],
            location="AndroidManifest.xml", masvs="MASVS-PLATFORM-1", owasp_mobile="M4",
        ))

        # Task hijacking heuristic.
        if tag == "activity" and _a(child, "launchMode") in ("singleTask", "singleInstance"):
            report.add(Finding(
                "ANDROID_TASK_HIJACK",
                f"Potential task hijacking ({name})", Severity.LOW, Category.PLATFORM,
                "An exported activity with singleTask/singleInstance launchMode may "
                "be susceptible to task hijacking / StrandHogg-style attacks.",
                "Set taskAffinity=\"\" and review launchMode, or require FLAG_ACTIVITY_NEW_TASK controls.",
                evidence=[f"activity {name} launchMode={_a(child,'launchMode')}"],
                location="AndroidManifest.xml", masvs="MASVS-PLATFORM-1",
                confidence="tentative",
            ))

    app.extra["exported_components"] = exported_count


def _is_launcher(intent_filters) -> bool:
    for ifil in intent_filters:
        actions = {_a(a, "name") for a in ifil.findall("action")}
        cats = {_a(c, "name") for c in ifil.findall("category")}
        if ("android.intent.action.MAIN" in actions
                and "android.intent.category.LAUNCHER" in cats):
            return True
    return False


def _check_permissions(manifest, report: Report) -> None:
    requested = []
    for perm in manifest.findall("uses-permission"):
        n = _a(perm, "name")
        if n:
            requested.append(n)
    sensitive = sorted(set(requested) & SENSITIVE_PERMISSIONS)
    if sensitive:
        report.add(Finding(
            "ANDROID_SENSITIVE_PERMS", "Sensitive permissions requested",
            Severity.INFO, Category.PRIVACY,
            "The app requests permissions that grant access to personal or "
            "high-risk data. Confirm each is justified and disclosed.",
            "Apply least privilege; remove unused permissions and document the rest "
            "in a privacy policy.",
            evidence=sensitive, location="AndroidManifest.xml",
            masvs="MASVS-PRIVACY-1", owasp_mobile="M6",
        ))

    # Custom permissions declared with weak protection level.
    for perm in manifest.findall("permission"):
        name = _a(perm, "name")
        level = (_a(perm, "protectionLevel") or "normal").lower()
        if level in ("normal", "dangerous") or level == "":
            report.add(Finding(
                "ANDROID_WEAK_CUSTOM_PERM",
                f"Custom permission with weak protectionLevel ({name})",
                Severity.LOW, Category.PLATFORM,
                f"Custom permission '{name}' uses protectionLevel='{level or 'normal'}'. "
                "If it guards sensitive components, any app can request/obtain it.",
                "Use protectionLevel=\"signature\" for permissions that guard private "
                "components so only your co-signed apps can hold them.",
                evidence=[f"{name} protectionLevel={level or 'normal'}"],
                location="AndroidManifest.xml", masvs="MASVS-PLATFORM-1",
            ))


def _check_network_security_config(apk, manifest, report: Report) -> None:
    appel = manifest.find("application")
    if appel is None:
        return
    nsc = _a(appel, "networkSecurityConfig")
    if not nsc:
        return
    # Try to locate and read the referenced XML file.
    for candidate in apk.get_files():
        if candidate.startswith("res/") and candidate.endswith(".xml") and \
                ("network_security" in candidate or "network-security" in candidate):
            try:
                raw = apk.get_file(candidate)
            except Exception:  # noqa: BLE001
                continue
            text = bytes(raw).decode("utf-8", "replace")
            lower = text.lower()
            if "cleartexttrafficpermitted=\"true\"" in lower:
                report.add(Finding(
                    "ANDROID_NSC_CLEARTEXT", "Network Security Config permits cleartext",
                    Severity.MEDIUM, Category.NETWORK,
                    "The Network Security Config explicitly permits cleartext traffic "
                    "for some domain(s).",
                    "Set cleartextTrafficPermitted=\"false\"; use HTTPS everywhere.",
                    evidence=[candidate], location=candidate,
                    masvs="MASVS-NETWORK-1", owasp_mobile="M3",
                ))
            if "<trust-anchors" in lower and "user" in lower and "certificates" in lower:
                report.add(Finding(
                    "ANDROID_NSC_USER_CA", "Network Security Config trusts user CAs",
                    Severity.MEDIUM, Category.NETWORK,
                    "Trusting user-installed CA certificates makes HTTPS interception "
                    "(e.g. by proxies/malware) easier.",
                    "Trust only the system CA store in production builds.",
                    evidence=[candidate], location=candidate,
                    masvs="MASVS-NETWORK-1", owasp_mobile="M3",
                ))
            return


# ---------------------------------------------------------------------------
# Signing & SDK
# ---------------------------------------------------------------------------
def _check_signing(apk, path: str, report: Report) -> None:
    try:
        signed = apk.is_signed()
    except Exception:  # noqa: BLE001
        signed = None
    v1 = _bool(lambda: apk.is_signed_v1())
    v2 = _bool(lambda: apk.is_signed_v2())
    v3 = _bool(lambda: apk.is_signed_v3())

    if signed is False and not (v1 or v2 or v3):
        report.add(Finding(
            "ANDROID_UNSIGNED", "APK is not signed", Severity.HIGH, Category.CODE,
            "The APK has no valid signature; integrity/authenticity cannot be verified.",
            "Sign release builds with a securely stored key using APK Signature "
            "Scheme v2/v3.",
            location=path, masvs="MASVS-RESILIENCE-1", owasp_mobile="M8",
        ))
    elif v1 and not (v2 or v3):
        report.add(Finding(
            "ANDROID_V1_ONLY_SIGNING", "Only legacy v1 (JAR) signing", Severity.MEDIUM,
            Category.CODE,
            "The app uses only APK Signature Scheme v1, which is vulnerable to "
            "integrity attacks (e.g. Janus, CVE-2017-13156) on older devices.",
            "Enable APK Signature Scheme v2/v3 (v4 where applicable).",
            evidence=[f"v1={v1} v2={v2} v3={v3}"], location=path,
            masvs="MASVS-RESILIENCE-1", owasp_mobile="M8",
        ))

    # Debug certificate detection (robust: scan DER bytes).
    try:
        import zipfile as _zip  # noqa: F401
        der_blobs = b""
        for getter in ("get_certificates_der_v3", "get_certificates_der_v2",
                       "get_certificate_der"):
            try:
                val = getattr(apk, getter)()
            except Exception:  # noqa: BLE001
                continue
            if not val:
                continue
            if isinstance(val, (list, tuple)):
                for v in val:
                    der_blobs += bytes(v) if v else b""
            else:
                der_blobs += bytes(val)
        if b"Android Debug" in der_blobs:
            report.add(Finding(
                "ANDROID_DEBUG_CERT", "Signed with the Android debug certificate",
                Severity.HIGH, Category.CODE,
                "The signing certificate is the shared public Android debug key "
                "(CN=Android Debug), so anyone can forge updates with the same key.",
                "Re-sign the release build with a private, securely stored release key.",
                location=path, masvs="MASVS-RESILIENCE-1", owasp_mobile="M8",
            ))
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"Certificate inspection skipped: {e}")


def _check_sdk_versions(app: AppInfo, report: Report) -> None:
    mn = _int(app.min_sdk)
    tg = _int(app.target_sdk)
    if mn is not None and mn < 24:
        report.add(Finding(
            "ANDROID_LOW_MIN_SDK", f"Low minSdkVersion ({mn})", Severity.MEDIUM,
            Category.PLATFORM,
            f"minSdkVersion {mn} supports old Android releases that lack modern "
            "TLS defaults, scoped storage and platform hardening.",
            "Raise minSdkVersion to 24+ (ideally 26+) where your user base allows.",
            evidence=[f"minSdk={mn}"], masvs="MASVS-PLATFORM-1",
        ))
    if tg is not None and tg < 30:
        report.add(Finding(
            "ANDROID_LOW_TARGET_SDK", f"Outdated targetSdkVersion ({tg})",
            Severity.MEDIUM, Category.PLATFORM,
            f"targetSdkVersion {tg} opts out of newer platform security defaults "
            "(scoped storage, restricted exports, stricter intents).",
            "Target the latest stable API level and adapt to its requirements.",
            evidence=[f"targetSdk={tg}"], masvs="MASVS-PLATFORM-1",
        ))


# ---------------------------------------------------------------------------
# Content scanning
# ---------------------------------------------------------------------------
def _collect_dex_strings(apk, report: Report) -> str:
    parts: list[str] = []
    count = 0
    try:
        for dex in apk.get_all_dex():
            for s in iter_ascii_strings(bytes(dex), min_len=5):
                parts.append(s)
                count += 1
                if count >= _MAX_STRINGS:
                    break
            if count >= _MAX_STRINGS:
                break
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"DEX string extraction partial: {e}")
    return "\n".join(parts)


def _secret_scan(apk, dex_blob: str, report: Report) -> None:
    items: list[tuple[str, bytes]] = []
    # DEX strings as a single blob.
    items.append(("classes.dex (strings)", dex_blob.encode("utf-8", "replace")))
    try:
        names = apk.get_files()
    except Exception:  # noqa: BLE001
        names = []
    scanned = 0
    for name in names:
        if scanned > 2500:
            break
        lower = name.lower()
        if name.endswith(".dex"):
            continue  # already covered by dex_blob
        is_text = lower.endswith(_TEXT_EXT)
        is_arsc = lower.endswith("resources.arsc")
        if not (is_text or is_arsc):
            continue
        try:
            raw = bytes(apk.get_file(name))
        except Exception:  # noqa: BLE001
            continue
        if len(raw) > _MAX_FILE_BYTES:
            raw = raw[:_MAX_FILE_BYTES]
        if is_arsc:
            raw = "\n".join(iter_ascii_strings(raw, 6, limit=50_000)).encode("utf-8", "replace")
        items.append((name, raw))
        scanned += 1

    for hit in secrets_scan.scan_many(items):
        sev = {"critical": Severity.CRITICAL, "high": Severity.HIGH,
               "medium": Severity.MEDIUM, "low": Severity.LOW}.get(hit["severity"], Severity.MEDIUM)
        report.add(Finding(
            f"SECRET_{hit['rule_id']}",
            f"Hardcoded secret: {hit['name']}", sev, Category.SECRETS,
            "A credential-like value is embedded in the app package. Anyone can "
            "extract it by unzipping the binary.",
            "Remove secrets from the client. Use a backend broker, short-lived "
            "tokens, and the Android Keystore; rotate any exposed credential.",
            evidence=[f"{hit['location']}: {hit['match']}"],
            location=hit["location"], masvs="MASVS-STORAGE-1", owasp_mobile="M1",
        ))


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _bool(fn) -> bool:
    try:
        return bool(fn())
    except Exception:  # noqa: BLE001
        return False
