"""Binary string extraction and entropy helpers (used for DEX/.so/arsc scanning)."""
from __future__ import annotations

import math
import re
from collections.abc import Iterator

# Printable ASCII run, like unix `strings`.
_ASCII_RUN = re.compile(rb"[\x20-\x7e]{%d,}")


def iter_ascii_strings(data: bytes, min_len: int = 5, limit: int | None = None) -> Iterator[str]:
    """Yield printable ASCII strings of at least min_len chars from raw bytes.

    `limit` caps how many strings are yielded (protects against huge binaries).
    """
    pattern = re.compile(rb"[\x20-\x7e]{%d,}" % min_len)
    count = 0
    for m in pattern.finditer(data):
        yield m.group().decode("ascii", "replace")
        count += 1
        if limit is not None and count >= limit:
            return


def shannon_entropy(s: str) -> float:
    """Shannon entropy in bits/char. Random-ish secrets score ~4.0+."""
    if not s:
        return 0.0
    freq: dict[str, int] = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


# Common words that produce false positives in secret detection.
_COMMON_TOKENS = {
    "androidx", "kotlinx", "application", "configuration", "notification",
    "implementation", "authorization", "transformation", "recyclerview",
}


def looks_like_secret(value: str, min_entropy: float = 3.5, min_len: int = 16) -> bool:
    """Heuristic: long, high-entropy, not an obvious dictionary/package token."""
    if len(value) < min_len:
        return False
    low = value.lower()
    if low in _COMMON_TOKENS:
        return False
    # Fully alphabetic lowercase with no digits is usually an identifier.
    if value.isalpha() and value.islower():
        return False
    return shannon_entropy(value) >= min_entropy
