"""Command-line scanner (useful in CI).

Usage:
    python -m app.cli path/to/app.apk [--json out.json] [--fail-on high]

Exit codes:
    0  no finding at/above --fail-on threshold
    2  findings at/above threshold (useful to break a CI build)
    1  scan error / bad usage
"""
from __future__ import annotations

import argparse
import json
import sys

from .analyzer import scan_file
from .analyzer.models import Severity

_THRESHOLDS = ["critical", "high", "medium", "low", "info", "none"]
_COLORS = {
    "critical": "\033[1;37;41m", "high": "\033[1;31m", "medium": "\033[1;33m",
    "low": "\033[1;36m", "info": "\033[1;90m",
}
_RESET = "\033[0m"


def _c(sev: str, text: str, color: bool) -> str:
    if not color:
        return text
    return f"{_COLORS.get(sev, '')}{text}{_RESET}"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Mobile app (APK/IPA) static security scanner.")
    p.add_argument("target", help="Path to .apk or .ipa")
    p.add_argument("--json", metavar="FILE", help="Write full JSON report to FILE")
    p.add_argument("--fail-on", choices=_THRESHOLDS, default="none",
                   help="Exit 2 if any finding is at/above this severity (default: none)")
    p.add_argument("--no-color", action="store_true")
    args = p.parse_args(argv)

    try:
        report = scan_file(args.target)
    except FileNotFoundError:
        print(f"error: file not found: {args.target}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"error: scan failed: {e}", file=sys.stderr)
        return 1

    data = report.to_dict()
    color = sys.stdout.isatty() and not args.no_color

    app = data["app"]
    summ = data["summary"]
    print(f"\n  {app['label'] or app['file_name']}  [{app['platform']}]")
    print(f"  package={app['package']}  version={app['version_name']} ({app['version_code']})")
    print(f"  sha256={app['sha256']}")
    print(f"  risk score: {summ['risk_score']}/100   grade: {summ['grade']}   "
          f"findings: {summ['total_findings']}")
    sc = summ["severity_counts"]
    print("  " + "  ".join(
        _c(s, f"{s}:{sc[s]}", color) for s in ["critical", "high", "medium", "low", "info"]
    ))
    print()
    for f in data["findings"]:
        tag = _c(f["severity"], f"[{f['severity'].upper():^8}]", color)
        conf = "" if f.get("confidence") == "firm" else "  (heuristic)"
        print(f"  {tag} {f['title']}{conf}")
        if f.get("location"):
            print(f"            ↳ {f['location']}  {f.get('masvs') or ''} {f.get('owasp_mobile') or ''}")
    if data["errors"]:
        print("\n  notes:")
        for e in data["errors"]:
            print(f"    - {e}")

    if args.json:
        with open(args.json, "w") as fh:
            json.dump(data, fh, indent=2)
        print(f"\n  JSON report written to {args.json}")

    # --fail-on handling
    if args.fail_on != "none":
        thr = Severity(args.fail_on).rank
        worst = max((Severity(f["severity"]).rank for f in data["findings"]), default=-1)
        if worst >= thr:
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
