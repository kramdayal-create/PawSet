"""Scan orchestration: detect platform, compute metadata, dispatch, time."""
from __future__ import annotations

import hashlib
import os
import time
import zipfile

from .models import AppInfo, Report


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_platform(path: str) -> str:
    """Return 'android', 'ios', or 'unknown'."""
    if not zipfile.is_zipfile(path):
        return "unknown"
    try:
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
    except Exception:  # noqa: BLE001
        return "unknown"
    nameset = set(names)
    if "AndroidManifest.xml" in nameset or any(n.endswith(".dex") for n in names):
        return "android"
    if any(n.startswith("Payload/") and ".app/" in n for n in names):
        return "ios"
    # Fall back on file extension.
    low = path.lower()
    if low.endswith(".apk") or low.endswith(".aab"):
        return "android"
    if low.endswith(".ipa"):
        return "ios"
    return "unknown"


def scan_file(path: str, declared_name: str | None = None) -> Report:
    start = time.time()
    name = declared_name or os.path.basename(path)
    platform = detect_platform(path)
    app = AppInfo(
        platform=platform,
        file_name=name,
        file_size=os.path.getsize(path),
        sha256=_sha256(path),
    )
    report = Report(app=app)

    if platform == "android":
        from . import apk
        apk.analyze(path, app, report)
    elif platform == "ios":
        from . import ipa
        ipa.analyze(path, app, report)
    else:
        report.errors.append(
            "Unrecognized file. Provide a valid .apk (Android) or .ipa (iOS). "
            "Note: .aab bundles and encrypted packages are not supported."
        )

    report.scan_seconds = time.time() - start
    return report
