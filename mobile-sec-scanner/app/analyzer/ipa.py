"""iOS IPA static analysis (Info.plist / ATS / Mach-O hardening)."""
from __future__ import annotations

import plistlib
import posixpath
import re
import zipfile

from . import code_heuristics, macho, secrets_scan
from .models import AppInfo, Category, Finding, Report, Severity
from .strings_util import iter_ascii_strings

_MAX_BIN_BYTES = 60 * 1024 * 1024
_MAX_STRINGS = 300_000
_TEXT_EXT = (".plist", ".json", ".js", ".txt", ".xml", ".html", ".pem", ".cfg",
             ".strings", ".mobileprovision")


def analyze(path: str, app: AppInfo, report: Report) -> None:
    try:
        zf = zipfile.ZipFile(path)
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"IPA is not a valid zip: {e}")
        return

    with zf:
        names = zf.namelist()
        app_dir = _find_app_dir(names)
        if not app_dir:
            report.errors.append("Could not locate Payload/<App>.app inside the IPA.")
            return

        info_plist_name = posixpath.join(app_dir, "Info.plist")
        plist = _read_plist(zf, info_plist_name, report)
        exe_name = None
        if plist:
            app.package = plist.get("CFBundleIdentifier")
            app.label = plist.get("CFBundleDisplayName") or plist.get("CFBundleName")
            app.version_name = plist.get("CFBundleShortVersionString")
            app.version_code = str(plist.get("CFBundleVersion", "")) or None
            app.min_sdk = plist.get("MinimumOSVersion")
            app.target_sdk = plist.get("DTPlatformVersion")
            exe_name = plist.get("CFBundleExecutable")
            _check_ats(plist, report)
            _check_plist_flags(plist, report)
            _check_url_schemes(plist, report)
            _check_min_os(plist, report)

        _check_provisioning(zf, app_dir, report)

        # Mach-O hardening on the main executable.
        if exe_name:
            exe_path = posixpath.join(app_dir, exe_name)
            _check_macho(zf, exe_path, app, report)

        _secret_scan(zf, app_dir, report)


def _find_app_dir(names: list[str]) -> str | None:
    for n in names:
        # e.g. "Payload/MyApp.app/Info.plist"
        m = re.match(r"(Payload/[^/]+\.app)/", n)
        if m:
            return m.group(1)
    return None


def _read_plist(zf: zipfile.ZipFile, name: str, report: Report) -> dict | None:
    try:
        raw = zf.read(name)
    except KeyError:
        return None
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"Failed reading {name}: {e}")
        return None
    try:
        return plistlib.loads(raw)
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"Failed parsing plist {name}: {e}")
        return None


# ---------------------------------------------------------------------------
# Info.plist checks
# ---------------------------------------------------------------------------
def _check_ats(plist: dict, report: Report) -> None:
    ats = plist.get("NSAppTransportSecurity")
    if not isinstance(ats, dict):
        return
    if ats.get("NSAllowsArbitraryLoads") is True:
        report.add(Finding(
            "IOS_ATS_ARBITRARY_LOADS", "ATS disabled globally (arbitrary loads)",
            Severity.HIGH, Category.NETWORK,
            "NSAllowsArbitraryLoads=true disables App Transport Security app-wide, "
            "permitting insecure HTTP and weak TLS.",
            "Remove NSAllowsArbitraryLoads; use HTTPS with TLS 1.2+. Scope any "
            "unavoidable exception to a specific domain.",
            evidence=["NSAppTransportSecurity.NSAllowsArbitraryLoads = true"],
            location="Info.plist", masvs="MASVS-NETWORK-1", owasp_mobile="M3",
        ))
    if ats.get("NSAllowsArbitraryLoadsInWebContent") is True:
        report.add(Finding(
            "IOS_ATS_WEBCONTENT", "ATS disabled for web content", Severity.MEDIUM,
            Category.NETWORK,
            "NSAllowsArbitraryLoadsInWebContent=true lets WebViews load insecure HTTP.",
            "Avoid this exception; load only HTTPS content in WebViews.",
            evidence=["NSAllowsArbitraryLoadsInWebContent = true"],
            location="Info.plist", masvs="MASVS-NETWORK-1", owasp_mobile="M3",
        ))
    domains = ats.get("NSExceptionDomains")
    if isinstance(domains, dict):
        weak = []
        for dom, cfg in domains.items():
            if not isinstance(cfg, dict):
                continue
            if cfg.get("NSExceptionAllowsInsecureHTTPLoads") is True or \
                    cfg.get("NSThirdPartyExceptionAllowsInsecureHTTPLoads") is True:
                weak.append(dom)
            tls = cfg.get("NSExceptionMinimumTLSVersion")
            if tls in ("TLSv1.0", "TLSv1.1"):
                weak.append(f"{dom} (min TLS {tls})")
        if weak:
            report.add(Finding(
                "IOS_ATS_DOMAIN_EXCEPTIONS", "Insecure ATS per-domain exceptions",
                Severity.MEDIUM, Category.NETWORK,
                "Specific domains allow insecure HTTP loads or downgraded TLS.",
                "Remove insecure-load exceptions and require TLS 1.2+ per domain.",
                evidence=weak, location="Info.plist",
                masvs="MASVS-NETWORK-1", owasp_mobile="M3",
            ))


def _check_plist_flags(plist: dict, report: Report) -> None:
    if plist.get("UIFileSharingEnabled") is True:
        report.add(Finding(
            "IOS_FILE_SHARING", "iTunes/Finder file sharing enabled", Severity.MEDIUM,
            Category.STORAGE,
            "UIFileSharingEnabled exposes the app's Documents directory over USB/Finder.",
            "Disable file sharing unless required; never store secrets in Documents.",
            evidence=["UIFileSharingEnabled = true"], location="Info.plist",
            masvs="MASVS-STORAGE-2", owasp_mobile="M9",
        ))
    # Privacy usage strings present = app accesses that resource (informational).
    privacy_keys = [k for k in plist if k.startswith("NS") and k.endswith("UsageDescription")]
    if privacy_keys:
        report.add(Finding(
            "IOS_PRIVACY_USAGE", "Sensitive resource access declared", Severity.INFO,
            Category.PRIVACY,
            "The app declares access to privacy-sensitive resources.",
            "Confirm each access is necessary and disclosed in your privacy policy.",
            evidence=sorted(privacy_keys), location="Info.plist",
            masvs="MASVS-PRIVACY-1", owasp_mobile="M6",
        ))


def _check_url_schemes(plist: dict, report: Report) -> None:
    schemes: list[str] = []
    for entry in plist.get("CFBundleURLTypes", []) or []:
        if isinstance(entry, dict):
            for s in entry.get("CFBundleURLSchemes", []) or []:
                schemes.append(str(s))
    if schemes:
        report.add(Finding(
            "IOS_CUSTOM_URL_SCHEMES", "Custom URL schemes registered", Severity.LOW,
            Category.PLATFORM,
            f"The app registers custom URL scheme(s): {', '.join(schemes)}. Other "
            "apps can invoke these; unvalidated parameters can drive unintended actions "
            "and schemes can be hijacked by a malicious app registering the same scheme.",
            "Validate all inbound URL parameters; prefer Universal Links over custom "
            "schemes for sensitive flows.",
            evidence=schemes, location="Info.plist",
            masvs="MASVS-PLATFORM-1", owasp_mobile="M4",
        ))


def _check_min_os(plist: dict, report: Report) -> None:
    mn = plist.get("MinimumOSVersion")
    try:
        major = int(str(mn).split(".")[0])
    except (TypeError, ValueError):
        return
    if major < 14:
        report.add(Finding(
            "IOS_LOW_MIN_OS", f"Low MinimumOSVersion ({mn})", Severity.LOW,
            Category.PLATFORM,
            f"Supporting iOS {mn} keeps users on releases missing current platform "
            "security mitigations.",
            "Raise the deployment target where your user base allows.",
            evidence=[f"MinimumOSVersion={mn}"], location="Info.plist",
            masvs="MASVS-PLATFORM-1",
        ))


def _check_provisioning(zf: zipfile.ZipFile, app_dir: str, report: Report) -> None:
    name = posixpath.join(app_dir, "embedded.mobileprovision")
    try:
        raw = zf.read(name)
    except Exception:  # noqa: BLE001
        return
    text = raw.decode("latin-1", "replace")
    # get-task-allow=true => debuggable (development/ad-hoc), not an App Store build.
    if re.search(r"<key>get-task-allow</key>\s*<true/>", text):
        report.add(Finding(
            "IOS_GET_TASK_ALLOW", "Debuggable entitlement (get-task-allow=true)",
            Severity.HIGH, Category.CODE,
            "The embedded provisioning profile/entitlements set get-task-allow=true, "
            "allowing a debugger to attach and dump process memory. This indicates a "
            "development/ad-hoc build, not an App Store release.",
            "Ship App Store / distribution builds where get-task-allow is false.",
            evidence=["embedded.mobileprovision: get-task-allow=true"],
            location=name, masvs="MASVS-RESILIENCE-2", owasp_mobile="M8",
        ))
    if "ProvisionsAllDevices" in text or re.search(r"<key>ProvisionedDevices</key>", text):
        report.add(Finding(
            "IOS_DEV_PROFILE", "Development/ad-hoc provisioning profile", Severity.INFO,
            Category.CODE,
            "The profile enumerates provisioned devices (development/ad-hoc), not a "
            "store distribution profile.",
            "Use an App Store distribution profile for production releases.",
            location=name, masvs="MASVS-RESILIENCE-2",
        ))


def _check_macho(zf: zipfile.ZipFile, exe_path: str, app: AppInfo, report: Report) -> None:
    try:
        data = zf.read(exe_path)
    except Exception as e:  # noqa: BLE001
        report.errors.append(f"Could not read executable {exe_path}: {e}")
        return
    if len(data) > _MAX_BIN_BYTES:
        report.errors.append("Executable larger than scan cap; hardening checks skipped.")
        return

    info = macho.parse(data)
    if not info.is_macho:
        report.errors.append(f"{exe_path} is not a Mach-O binary.")
        return
    app.extra["architectures"] = info.archs
    app.extra["app_store_encrypted"] = info.encrypted

    if info.pie is False:
        report.add(Finding(
            "IOS_NO_PIE", "Executable not position-independent (no PIE/ASLR)",
            Severity.MEDIUM, Category.CODE,
            "The main binary lacks the MH_PIE flag, weakening ASLR and making memory-"
            "corruption exploitation easier.",
            "Build with PIE enabled (Xcode default; ensure -no_pie is not set).",
            evidence=[f"archs={info.archs}"], location=exe_path,
            masvs="MASVS-RESILIENCE-3", owasp_mobile="M8",
        ))
    if info.has_stack_canary is False:
        report.add(Finding(
            "IOS_NO_STACK_CANARY", "No stack-canary symbols detected", Severity.LOW,
            Category.CODE,
            "Stack protector symbols (__stack_chk_fail/guard) were not found, which "
            "may indicate stack-smashing protection is disabled. (Heuristic.)",
            "Compile with -fstack-protector-all for security-sensitive code.",
            evidence=[exe_path], location=exe_path,
            masvs="MASVS-RESILIENCE-3", owasp_mobile="M8", confidence="tentative",
        ))
    if info.has_arc is False:
        report.add(Finding(
            "IOS_NO_ARC", "Automatic Reference Counting not detected", Severity.INFO,
            Category.CODE,
            "ARC runtime symbols were not found; manual memory management raises the "
            "risk of use-after-free/double-free bugs. (Heuristic.)",
            "Use ARC for Objective-C/Swift code.",
            evidence=[exe_path], location=exe_path,
            masvs="MASVS-RESILIENCE-3", confidence="tentative",
        ))
    if info.encrypted is False:
        report.add(Finding(
            "IOS_NOT_ENCRYPTED", "Binary is not App Store (FairPlay) encrypted",
            Severity.INFO, Category.CODE,
            "LC_ENCRYPTION_INFO cryptid=0: the binary is not FairPlay-encrypted, so "
            "its code/strings are directly readable. Expected for dev/ad-hoc builds.",
            "No action if this is a pre-store build; App Store distribution adds "
            "FairPlay encryption automatically.",
            location=exe_path, masvs="MASVS-RESILIENCE-4", confidence="tentative",
        ))

    # Code heuristics over binary strings.
    blob = "\n".join(iter_ascii_strings(data, 5, limit=_MAX_STRINGS))
    report.findings.extend(code_heuristics.run(blob, "ios", exe_path))


def _secret_scan(zf: zipfile.ZipFile, app_dir: str, report: Report) -> None:
    items: list[tuple[str, bytes]] = []
    scanned = 0
    for name in zf.namelist():
        if scanned > 1500:
            break
        if name.endswith("/"):
            continue
        lower = name.lower()
        base = posixpath.basename(lower)
        is_exe = base and not posixpath.splitext(base)[1] and f"{app_dir}/" in name
        if lower.endswith(_TEXT_EXT):
            try:
                raw = zf.read(name)
            except Exception:  # noqa: BLE001
                continue
            items.append((name, raw[:_MAX_BIN_BYTES]))
            scanned += 1
        elif is_exe:
            try:
                raw = zf.read(name)
            except Exception:  # noqa: BLE001
                continue
            blob = "\n".join(iter_ascii_strings(raw[:_MAX_BIN_BYTES], 6, limit=_MAX_STRINGS))
            items.append((name + " (strings)", blob.encode("utf-8", "replace")))
            scanned += 1

    for hit in secrets_scan.scan_many(items):
        sev = {"critical": Severity.CRITICAL, "high": Severity.HIGH,
               "medium": Severity.MEDIUM, "low": Severity.LOW}.get(hit["severity"], Severity.MEDIUM)
        report.add(Finding(
            f"SECRET_{hit['rule_id']}",
            f"Hardcoded secret: {hit['name']}", sev, Category.SECRETS,
            "A credential-like value is embedded in the IPA and can be extracted by "
            "unzipping the package.",
            "Remove secrets from the client; use a backend broker, short-lived tokens "
            "and the iOS Keychain. Rotate any exposed credential.",
            evidence=[f"{hit['location']}: {hit['match']}"],
            location=hit["location"], masvs="MASVS-STORAGE-1", owasp_mobile="M1",
        ))
