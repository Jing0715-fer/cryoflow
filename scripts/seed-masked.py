#!/usr/bin/env python3
"""Task 210 — seed a third speaking map (a masked variant) into the sandbox.

t208's pair territory row assumed ONE pair (the sandbox's two half-maps);
t210's lane packing needs a MULTI-PAIR world to prove every door stays
pressable. Three speaking overlays make three pairs (C(3,2)), and the
band geometry is engineered so the packing actually splits:

    pair(half1, half2)  -> Q3 [0.50-0.75]   (the t208 world's own pair)
    pair(half1, masked) -> Q2 [0.25-0.50]   (half1 ascends Q2, masked descends)
    pair(half2, masked) -> Q2 [0.25-0.50]   (same quarter -> DIFFERENT lane)

Lane packing (sort by from, first lane whose end <= from): lane0 holds
(half1,masked) Q2 + (half1,half2) Q3 (disjoint, share the bottom lane);
lane1 holds (half2,masked) Q2 (the same-quarter split). One shared lane,
one split lane, three pressable doors.

The profile recipe: a z-constant tube (cx=26, distinguishable from both
halves' drifting tubes) + one shallow blob (z=8) + one deep blob (z=28).
The shallow blob makes masked DESCEND through Q2 while half1 ascends
through it (strong negative), and the deep blob keeps masked ascending
through Q3 while half1 descends (so pair(half1,masked) cannot drift to
Q3). Writes run_it020_masked.mrc (32^3 float32, the exact header layout
qa67-seed-volume.py proved out). Idempotent; --clean removes it.
"""
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import resolve_refine_host, resolve_project  # noqa: E402

N = 32
NAME = "run_it020_masked.mrc"


def write_mrc(path, vals, n):
    # EXACT field layout of qa67-seed-volume.py's proven writer (the
    # minimal header variant that keeps Mol* from RangeError-ing)
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


def masked_volume():
    # z-constant tube at cx=26 (neither half's anchor) + a SHALLOW blob
    # (z=8: descends through Q2) + a DEEP blob (z=28: ascends through Q3,
    # descends through Q4). The two blobs give the z-profile the two
    # opposing slopes the pair-oracle engineering needs.
    vals = []
    for z in range(N):
        for y in range(N):
            for x in range(N):
                v = math.exp(-((x - 26) ** 2 + (y - N / 2) ** 2) / 18.0)
                v += 0.9 * math.exp(-((x - 10) ** 2 + (y - 8) ** 2 + (z - 8) ** 2) / 12.0)
                v += 0.9 * math.exp(-((x - 28) ** 2 + (y - 24) ** 2 + (z - 28) ** 2) / 12.0)
                vals.append(v)
    return vals


def main():
    clean = "--clean" in sys.argv
    _, project = resolve_project(), None
    job, wd = resolve_refine_host(resolve_project())
    target = os.path.join(wd, NAME)
    if clean:
        if os.path.exists(target):
            os.remove(target)
            print(f"cleaned: {target}")
        return
    write_mrc(target, masked_volume(), N)
    print(f"written: {target}")
    print("seed OK")


if __name__ == "__main__":
    main()
