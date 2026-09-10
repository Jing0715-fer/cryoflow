#!/usr/bin/env python3
"""Task 107 — seed two synthetic half-map volumes into the refine3d sandbox.

The layers popover (overlay maps picker) lists OTHER volumes from the job's
workdir — half-maps, masked, classes. The current sandbox workdir carries
star tables + the orthovol.mrc from qa67-seed-volume.py but no secondary
maps, so the picker has no choices and qa44's overlay PUT chain regression
has nothing to pick.

Writes run_it020_half1.mrc / run_it020_half2.mrc (32³ float32, distinct
axis-drift so the overlays are visually distinguishable). Idempotent:
overwrites on each run; --clean removes both.
"""
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import resolve_refine_host, resolve_project  # noqa: E402

N = 32
FILES = ["run_it020_half1.mrc", "run_it020_half2.mrc"]


def write_mrc(path, vals, n):
    # EXACT field layout of qa67-seed-volume.py's proven writer — the
    # minimal header variant logged "RangeError: Invalid typed array
    # length: -Infinity" inside Mol* (dmin/dmax/dmean left as garbage-0)
    buf = bytearray(1024)
    i32 = lambda off, v: struct.pack_into("<i", buf, off, v)  # noqa: E731
    f32 = lambda off, v: struct.pack_into("<f", buf, off, v)  # noqa: E731
    i32(0, n); i32(4, n); i32(8, n)
    i32(12, 2)                 # mode float32
    i32(16, 0); i32(20, 0); i32(24, 0)   # start
    i32(28, n); i32(32, n); i32(36, n)   # mx my mz
    f32(40, 1.0); f32(44, 1.0); f32(48, 1.0)  # cella
    f32(52, 90.0); f32(56, 90.0); f32(60, 90.0)
    i32(64, 1); i32(68, 2); i32(72, 3)   # mapc mapr maps
    f32(76, 0.0); f32(80, max(vals)); f32(84, sum(vals) / len(vals))
    i32(88, 1)                 # ispg
    i32(92, 0)                 # nsymbt
    buf[208:212] = b"MAP "
    struct.pack_into("<i", buf, 212, 16777214)
    with open(path, "wb") as f:
        f.write(bytes(buf))
        f.write(b"".join(struct.pack("<f", v) for v in vals))


def volume(which):
    # two drifting tubes at different anchors — distinguishable slices
    cx = 8 + 12 * which
    vals = []
    for z in range(N):
        for y in range(N):
            for x in range(N):
                v = math.exp(-((x - cx) ** 2 + (y - N / 2) ** 2) / 18.0)
                v += 0.5 * math.exp(-((x - 24) ** 2 + (y - 8) ** 2 + (z - 16 - 8 * which) ** 2) / 12.0)
                vals.append(v)
    return vals


def main():
    clean = "--clean" in sys.argv
    _, project = resolve_project(), None
    job, wd = resolve_refine_host(resolve_project())
    for name in FILES:
        target = os.path.join(wd, name)
        if clean:
            if os.path.exists(target):
                os.remove(target)
                print(f"cleaned: {target}")
            continue
        write_mrc(target, volume(0 if "half1" in name else 1), N)
        print(f"written: {target}")
    if not clean:
        print("seed OK")


if __name__ == "__main__":
    main()
