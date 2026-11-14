"""Core data model for scan findings and reports."""
from __future__ import annotations

import dataclasses
import enum
from dataclasses import dataclass, field
from typing import Any


class Severity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

    @property
    def weight(self) -> int:
        return {
            "critical": 40,
            "high": 20,
            "medium": 8,
            "low": 3,
            "info": 0,
        }[self.value]

    @property
    def rank(self) -> int:
        order = ["info", "low", "medium", "high", "critical"]
        return order.index(self.value)


# Analysis categories, loosely aligned with OWASP MASVS v2 control groups.
class Category(str, enum.Enum):
    STORAGE = "Data Storage"
    CRYPTO = "Cryptography"
    NETWORK = "Network Communication"
    PLATFORM = "Platform Interaction"
    CODE = "Code Quality & Build"
    AUTH = "Authentication"
    RESILIENCE = "Resilience & Anti-Tampering"
    PRIVACY = "Privacy"
    SECRETS = "Hardcoded Secrets"
    DEPENDENCY = "Third-Party Components"


@dataclass
class Finding:
    id: str                       # stable rule id, e.g. "ANDROID_DEBUGGABLE"
    title: str
    severity: Severity
    category: Category
    description: str
    recommendation: str
    evidence: list[str] = field(default_factory=list)
    location: str | None = None   # file/path/component the finding relates to
    masvs: str | None = None      # OWASP MASVS v2 control, e.g. "MASVS-NETWORK-1"
    owasp_mobile: str | None = None  # OWASP Mobile Top 10 (2024), e.g. "M4"
    references: list[str] = field(default_factory=list)
    confidence: str = "firm"      # firm | tentative (heuristic)

    def to_dict(self) -> dict[str, Any]:
        d = dataclasses.asdict(self)
        d["severity"] = self.severity.value
        d["category"] = self.category.value
        # Keep evidence bounded so the report stays readable.
        if len(d["evidence"]) > 25:
            extra = len(d["evidence"]) - 25
            d["evidence"] = d["evidence"][:25] + [f"... and {extra} more"]
        return d


@dataclass
class AppInfo:
    platform: str                 # "android" | "ios"
    file_name: str
    file_size: int
    sha256: str
    package: str | None = None
    label: str | None = None
    version_name: str | None = None
    version_code: str | None = None
    min_sdk: str | None = None
    target_sdk: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass
class Report:
    app: AppInfo
    findings: list[Finding] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    scan_seconds: float = 0.0

    def add(self, finding: Finding) -> None:
        self.findings.append(finding)

    # ---- scoring -------------------------------------------------------
    def severity_counts(self) -> dict[str, int]:
        counts = {s.value: 0 for s in Severity}
        for f in self.findings:
            counts[f.severity.value] += 1
        return counts

    def risk_score(self) -> int:
        """0 (clean) .. 100 (very risky). Saturating sum of severity weights."""
        total = sum(f.severity.weight for f in self.findings)
        return min(100, total)

    def grade(self) -> str:
        score = self.risk_score()
        counts = self.severity_counts()
        if counts["critical"] > 0 or score >= 70:
            return "F"
        if counts["high"] > 0 or score >= 45:
            return "D"
        if score >= 25:
            return "C"
        if score >= 10:
            return "B"
        return "A"

    def to_dict(self) -> dict[str, Any]:
        ordered = sorted(
            self.findings,
            key=lambda f: (-f.severity.rank, f.category.value, f.id),
        )
        return {
            "app": self.app.to_dict(),
            "summary": {
                "risk_score": self.risk_score(),
                "grade": self.grade(),
                "severity_counts": self.severity_counts(),
                "total_findings": len(self.findings),
            },
            "findings": [f.to_dict() for f in ordered],
            "errors": self.errors,
            "scan_seconds": round(self.scan_seconds, 3),
        }
