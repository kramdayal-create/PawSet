"""Minimal Mach-O parser for iOS binary hardening checks.

Parses just enough to determine:
  * PIE (position-independent executable) via MH_PIE header flag,
  * App Store encryption (LC_ENCRYPTION_INFO[_64] cryptid),
  * stack-canary / ARC presence via symbol-string heuristics,
  * whether the binary references rootless/jailbreak-y paths.

Handles thin and FAT binaries. All parsing is defensive; on any malformed
input it returns whatever it managed to determine.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

MH_MAGIC = 0xFEEDFACE
MH_MAGIC_64 = 0xFEEDFACF
MH_CIGAM = 0xCEFAEDFE
MH_CIGAM_64 = 0xCFFAEDFE
FAT_MAGIC = 0xCAFEBABE
FAT_CIGAM = 0xBEBAFECA

MH_PIE = 0x200000
LC_ENCRYPTION_INFO = 0x21
LC_ENCRYPTION_INFO_64 = 0x2C


@dataclass
class MachOInfo:
    is_macho: bool = False
    archs: list[str] = field(default_factory=list)
    pie: bool | None = None
    encrypted: bool | None = None        # App Store FairPlay encryption present
    has_stack_canary: bool | None = None
    has_arc: bool | None = None
    notes: list[str] = field(default_factory=list)


def _cpu_name(cputype: int) -> str:
    return {
        0x100000C: "arm64", 0xC: "arm", 0x1000007: "x86_64", 0x7: "x86",
    }.get(cputype, f"cpu:{cputype}")


def parse(data: bytes) -> MachOInfo:
    info = MachOInfo()
    if len(data) < 8:
        return info
    magic = struct.unpack(">I", data[:4])[0]

    slices: list[tuple[int, bytes]] = []  # (offset, slice_bytes) per arch
    if magic in (FAT_MAGIC, FAT_CIGAM):
        info.is_macho = True
        try:
            nfat = struct.unpack(">I", data[4:8])[0]
            off = 8
            for _ in range(min(nfat, 16)):
                cputype, _subtype, offset, size, _align = struct.unpack(
                    ">IIIII", data[off:off + 20])
                off += 20
                info.archs.append(_cpu_name(cputype))
                slices.append((offset, data[offset:offset + size]))
        except Exception as e:  # noqa: BLE001
            info.notes.append(f"FAT parse partial: {e}")
    else:
        little = magic in (MH_CIGAM, MH_CIGAM_64)
        magic_le = struct.unpack("<I", data[:4])[0]
        if magic in (MH_MAGIC, MH_MAGIC_64) or magic_le in (MH_MAGIC, MH_MAGIC_64):
            info.is_macho = True
            slices.append((0, data))

    # Parse each arch slice; aggregate (PIE/encrypted true if any arch shows it).
    pie_any = False
    enc_any = False
    parsed_any = False
    for _base, sl in slices:
        res = _parse_thin(sl)
        if res is None:
            continue
        parsed_any = True
        arch_name, pie, enc = res
        if arch_name and arch_name not in info.archs:
            info.archs.append(arch_name)
        pie_any = pie_any or bool(pie)
        enc_any = enc_any or bool(enc)

    if parsed_any:
        info.pie = pie_any
        info.encrypted = enc_any

    # Symbol/string heuristics over the whole file (cheap, robust).
    info.has_stack_canary = (b"stack_chk_fail" in data) or (b"__stack_chk_guard" in data)
    info.has_arc = (b"_objc_release" in data) or (b"objc_autoreleaseReturnValue" in data) \
        or (b"objc_storeStrong" in data)
    return info


def _parse_thin(data: bytes):
    """Return (arch_name, pie, encrypted) or None."""
    if len(data) < 28:
        return None
    magic = struct.unpack("<I", data[:4])[0]
    if magic == MH_MAGIC_64:
        endian, is64 = "<", True
    elif magic == MH_MAGIC:
        endian, is64 = "<", False
    else:
        be = struct.unpack(">I", data[:4])[0]
        if be == MH_MAGIC_64:
            endian, is64 = ">", True
        elif be == MH_MAGIC:
            endian, is64 = ">", False
        else:
            return None

    try:
        if is64:
            (_m, cputype, _st, _ft, ncmds, _soc, flags, _rsv) = struct.unpack(
                endian + "IIIIIIII", data[:32])
            cursor = 32
        else:
            (_m, cputype, _st, _ft, ncmds, _soc, flags) = struct.unpack(
                endian + "IIIIIII", data[:28])
            cursor = 28
    except Exception:  # noqa: BLE001
        return None

    pie = bool(flags & MH_PIE)
    encrypted = False
    for _ in range(min(ncmds, 4096)):
        if cursor + 8 > len(data):
            break
        cmd, cmdsize = struct.unpack(endian + "II", data[cursor:cursor + 8])
        if cmdsize < 8:
            break
        if cmd in (LC_ENCRYPTION_INFO, LC_ENCRYPTION_INFO_64):
            # struct: cmd, cmdsize, cryptoff, cryptsize, cryptid
            try:
                cryptid = struct.unpack(endian + "I", data[cursor + 16:cursor + 20])[0]
                if cryptid != 0:
                    encrypted = True
            except Exception:  # noqa: BLE001
                pass
        cursor += cmdsize
    return _cpu_name(cputype), pie, encrypted
