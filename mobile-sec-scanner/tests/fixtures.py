"""Build synthetic, deliberately-vulnerable fixtures for tests.

These are hand-crafted so the analyzer has something realistic to chew on
without shipping (or downloading) any real third-party app binary.
"""
from __future__ import annotations

import plistlib
import struct
import zipfile


def build_macho_arm64(extra_strings: bytes = b"") -> bytes:
    """A tiny thin arm64 Mach-O: no PIE flag, LC_ENCRYPTION_INFO_64 cryptid=0."""
    header = struct.pack(
        "<IIIIIIII",
        0xFEEDFACF,   # magic (MH_MAGIC_64)
        0x0100000C,   # cputype arm64
        0,            # cpusubtype
        2,            # filetype MH_EXECUTE
        1,            # ncmds
        24,           # sizeofcmds
        0,            # flags  (MH_PIE deliberately NOT set)
        0,            # reserved
    )
    # LC_ENCRYPTION_INFO_64 = cmd, cmdsize, cryptoff, cryptsize, cryptid, pad
    lc = struct.pack("<IIIIII", 0x2C, 24, 0, 0, 0, 0)
    return header + lc + extra_strings


# Strings embedded in the executable to trip detectors.
_EXE_STRINGS = (
    b"_objc_release\x00"                       # ARC present (no finding)
    b"kSecAttrAccessibleAlways\x00"            # weak keychain
    b"using cipher AES/ECB/PKCS5Padding\x00"   # ECB mode
    b"sk_live_ABCDEFGH1234567890abcd\x00"      # Stripe live secret (critical)
    b"AIza" + b"B" * 35 + b"\x00"              # Google API key
    b"https://demo.firebaseio.com\x00"         # Firebase URL
    b"-----BEGIN RSA PRIVATE KEY-----\x00"     # private key block
)

_MOBILEPROVISION = (
    b"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
    b"<plist version=\"1.0\"><dict>\n"
    b"<key>get-task-allow</key><true/>\n"
    b"<key>ProvisionedDevices</key><array><string>DEVICEUDID</string></array>\n"
    b"</dict></plist>\n"
)


def build_vulnerable_ipa(path: str) -> str:
    """Write a synthetic vulnerable IPA to `path` and return it."""
    info = {
        "CFBundleIdentifier": "com.example.vulnapp",
        "CFBundleDisplayName": "VulnApp",
        "CFBundleName": "VulnApp",
        "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": "1",
        "CFBundleExecutable": "VulnApp",
        "MinimumOSVersion": "12.0",
        "DTPlatformVersion": "16.0",
        "UIFileSharingEnabled": True,
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
        "CFBundleURLTypes": [{"CFBundleURLSchemes": ["vulnapp"]}],
        "NSCameraUsageDescription": "We use the camera to scan documents.",
    }
    plist_bytes = plistlib.dumps(info, fmt=plistlib.FMT_BINARY)
    exe = build_macho_arm64(_EXE_STRINGS)

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Payload/VulnApp.app/Info.plist", plist_bytes)
        zf.writestr("Payload/VulnApp.app/VulnApp", exe)
        zf.writestr("Payload/VulnApp.app/embedded.mobileprovision", _MOBILEPROVISION)
        zf.writestr("Payload/VulnApp.app/config.json",
                    b'{"api_key": "AKIAIOSFODNN7EXAMPLE", "endpoint": "http://insecure.example.com"}')
    return path
