"""Regex-based detection of hardcoded secrets and credentials.

Patterns target well-known, high-signal credential formats. Generic
assignment matches are additionally gated on entropy to cut false positives.
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from .strings_util import looks_like_secret


@dataclass(frozen=True)
class SecretRule:
    id: str
    name: str
    regex: re.Pattern[bytes]
    severity: str          # critical | high | medium | low
    entropy_gate: bool = False  # require the captured value to look random


# NOTE: patterns operate on bytes so they can run over raw DEX / .so / arsc data.
RULES: list[SecretRule] = [
    SecretRule("AWS_ACCESS_KEY", "AWS Access Key ID",
               re.compile(rb"\b(AKIA|ASIA)[0-9A-Z]{16}\b"), "high"),
    SecretRule("AWS_SECRET_KEY", "AWS Secret Access Key",
               re.compile(rb"(?i)aws.{0,20}?(secret|key).{0,5}?[=:\"']\s*([A-Za-z0-9/+]{40})"),
               "critical", entropy_gate=True),
    SecretRule("GOOGLE_API_KEY", "Google API Key",
               re.compile(rb"\bAIza[0-9A-Za-z\-_]{35}\b"), "high"),
    SecretRule("GCP_OAUTH", "Google OAuth Client ID",
               re.compile(rb"\b[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com\b"),
               "low"),
    SecretRule("FIREBASE_DB", "Firebase Database URL",
               re.compile(rb"\bhttps://[0-9a-z\-]+\.firebaseio\.com\b"), "low"),
    SecretRule("PRIVATE_KEY", "Private Key Block",
               re.compile(rb"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"),
               "critical"),
    SecretRule("STRIPE_LIVE", "Stripe Live Secret Key",
               re.compile(rb"\bsk_live_[0-9A-Za-z]{16,}\b"), "critical"),
    SecretRule("STRIPE_TEST", "Stripe Test Secret Key",
               re.compile(rb"\bsk_test_[0-9A-Za-z]{16,}\b"), "medium"),
    SecretRule("SLACK_TOKEN", "Slack Token",
               re.compile(rb"\bxox[baprs]-[0-9A-Za-z\-]{10,}\b"), "high"),
    SecretRule("GITHUB_PAT", "GitHub Personal Access Token",
               re.compile(rb"\b(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b"), "high"),
    SecretRule("JWT", "JSON Web Token",
               re.compile(rb"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
               "medium"),
    SecretRule("TWILIO", "Twilio API Key",
               re.compile(rb"\bSK[0-9a-fA-F]{32}\b"), "high"),
    SecretRule("SENDGRID", "SendGrid API Key",
               re.compile(rb"\bSG\.[0-9A-Za-z_\-]{22}\.[0-9A-Za-z_\-]{43}\b"), "high"),
    SecretRule("GENERIC_SECRET", "Generic Hardcoded Secret",
               re.compile(rb"(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)[\"']?\s*[:=]\s*[\"']?([A-Za-z0-9/+_\-\.]{12,})"),
               "medium", entropy_gate=True),
]


def _decode(b: bytes) -> str:
    return b.decode("utf-8", "replace")


def scan_bytes(data: bytes, location: str) -> list[dict]:
    """Return list of raw hits: {rule_id, name, severity, match, location}."""
    hits: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for rule in RULES:
        for m in rule.regex.finditer(data):
            # The value to entropy-check is the last captured group if present.
            groups = m.groups()
            value = _decode(groups[-1]) if groups and groups[-1] else _decode(m.group())
            if rule.entropy_gate and not looks_like_secret(value):
                continue
            snippet = _decode(m.group())
            if len(snippet) > 120:
                snippet = snippet[:117] + "..."
            key = (rule.id, snippet)
            if key in seen:
                continue
            seen.add(key)
            hits.append({
                "rule_id": rule.id,
                "name": rule.name,
                "severity": rule.severity,
                "match": _redact(snippet, rule.id),
                "location": location,
            })
    return hits


def _redact(snippet: str, rule_id: str) -> str:
    """Partially mask the secret value so the report itself isn't a leak."""
    if rule_id == "PRIVATE_KEY":
        return snippet  # just the header line
    # Keep a short prefix, mask the rest.
    if len(snippet) <= 12:
        return snippet[:4] + "****"
    return snippet[:8] + "…" + snippet[-4:] + f"  (masked, len={len(snippet)})"


def scan_many(items: Iterable[tuple[str, bytes]]) -> list[dict]:
    out: list[dict] = []
    for location, data in items:
        out.extend(scan_bytes(data, location))
    return out
