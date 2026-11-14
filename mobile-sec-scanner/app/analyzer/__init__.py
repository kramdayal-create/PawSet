"""Mobile app static security analyzer.

Public API:
    from app.analyzer import scan_file
    report = scan_file("/path/to/app.apk")
    report.to_dict()
"""
from .core import detect_platform, scan_file
from .models import AppInfo, Category, Finding, Report, Severity

__all__ = [
    "scan_file", "detect_platform",
    "Report", "Finding", "AppInfo", "Severity", "Category",
]
