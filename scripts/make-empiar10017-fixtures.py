#!/usr/bin/env python3
"""EMPIAR-10017-style fixture generator (t380).

The REAL 8 Falcon-II β-galactosidase micrographs from
https://ftp.ebi.ac.uk/empiar/world_availability/10017/data/ are 64 MiB each
and the sandbox's EBI bandwidth (~16 KB/s) makes re-downloading them an
8-hour affair. This generator synthesises the SAME SHAPE with the SAME
cryo physics and the SAME names:

  · 4096² float32 mode-2 MRCs (byte size 67,109,888 — the real file's size)
    under data2/empiar-10017/micrographs/, real Falcon_2012_06_12-* stems
  · all-positive ice plane (N(1000, 150) + slow per-mic drift — the
    micrograph renders WITHOUT the flip: dark particles on grey ice, the
    cryo truth the user described: 「冷冻照片颗粒是黑的」)
  · 64 β-gal blobs per mic on a jittered 8×8 grid — DARK Gaussian-profile
    tetramers (4 sub-lobes), diameter ≈ 180 Å at 1.77 Å/px
  · a few large dark aggregates per mic (the junk every real grid carries)
  · matching Henderson-format .coord files (x y per line) under
    data2/empiar-10017/coords/ — every coordinate sits on a REAL blob, so
    Extract's crops carry the true polarity
  · deterministic seeds: reruns are byte-identical

Usage:  python3 scripts/make-empiar10017-fixtures.py [mock-fs-root]
        (default root: services/mock-cluster/fs)
"""
import os
import struct
import sys

import numpy as np

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "services", "mock-cluster", "fs",
)
MIC_DIR = os.path.join(ROOT, "data2", "empiar-10017", "micrographs")
COORD_DIR = os.path.join(ROOT, "data2", "empiar-10017", "coords")

MICS = [
    "Falcon_2012_06_12-14_33_35_0",
    "Falcon_2012_06_12-14_57_34_0",
    "Falcon_2012_06_12-15_07_41_0",
    "Falcon_2012_06_12-15_14_01_0",
    "Falcon_2012_06_12-15_17_31_0",
    "Falcon_2012_06_12-15_27_22_0",
    "Falcon_2012_06_12-15_30_21_0",
    "Falcon_2012_06_12-15_33_42_0",
]

NX = NY = 4096
PIX = 1.77          # Å/px (the real entry's sampling)
BLOB_AMP = -430.0   # density dip of a β-gal tetramer vs ice
BLOB_SIGMA = 22.0   # px — 180 Å diameter ≈ 102 px, Gaussian σ ≈ 22


def write_mrc(path, nx, ny, nz, arr, angpix=PIX):
    flat = np.ascontiguousarray(arr, dtype="<f4").reshape(-1)
    header = bytearray(1024)
    struct.pack_into("<3i", header, 0, nx, ny, nz)
    struct.pack_into("<i", header, 12, 2)                     # MODE float32
    struct.pack_into("<3i", header, 16, 0, 0, 0)              # NXSTART…
    struct.pack_into("<3i", header, 28, nx, ny, nz)           # MX MY MZ
    struct.pack_into("<3f", header, 40, nx * angpix, ny * angpix, nz * angpix)
    struct.pack_into("<3f", header, 52, 90.0, 90.0, 90.0)
    struct.pack_into("<3i", header, 64, 1, 2, 3)
    struct.pack_into("<3f", header, 76, float(flat.min()), float(flat.max()), float(flat.mean()))
    struct.pack_into("<i", header, 88, 1)
    struct.pack_into("<i", header, 92, 0)
    struct.pack_into("<3f", header, 96, 0.0, 0.0, 0.0)
    header[208:212] = b"MAP "
    header[212:216] = b"\x44\x41\x00\x00"
    struct.pack_into("<f", header, 216, float(flat.std()))
    struct.pack_into("<i", header, 220, 1)
    with open(path, "wb") as fh:
        fh.write(header)
        fh.write(flat.tobytes())


def blob_profile(img, cx, cy, amp, sigma, rng, sublobes=4):
    """A β-gal tetramer: a main Gaussian dip + 4 sub-lobes at ±0.4σ."""
    h, w = img.shape
    y0, y1 = max(0, int(cy - 5 * sigma)), min(h, int(cy + 5 * sigma) + 1)
    x0, x1 = max(0, int(cx - 5 * sigma)), min(w, int(cx + 5 * sigma) + 1)
    if y1 <= y0 or x1 <= x0:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    r2 = (xx - cx) ** 2 + (yy - cy) ** 2
    dip = amp * np.exp(-r2 / (2.0 * sigma ** 2))
    for k in range(sublobes):
        ang = 2.0 * np.pi * (k + rng.random() * 0.3) / sublobes
        ox = cx + 0.45 * sigma * np.cos(ang)
        oy = cy + 0.45 * sigma * np.sin(ang)
        rr2 = (xx - ox) ** 2 + (yy - oy) ** 2
        dip += 0.35 * amp * np.exp(-rr2 / (2.0 * (0.35 * sigma) ** 2))
    img[y0:y1, x0:x1] += dip


def make_mic(seed):
    rng = np.random.default_rng(seed)
    # ice plane: positive mean + noise + slow 2D drift (real detectors band)
    img = rng.normal(1000.0, 150.0, (NY, NX)).astype(np.float32)
    drift = np.outer(np.sin(np.linspace(0, 3.1, NY)), np.cos(np.linspace(0, 2.7, NX)))
    img += (drift * 60.0).astype(np.float32)
    # 64 β-gal blobs on a jittered 8×8 grid
    coords = []
    for gy in range(8):
        for gx in range(8):
            cx = 256 + gx * 512 + float(rng.uniform(-110, 110))
            cy = 256 + gy * 512 + float(rng.uniform(-110, 110))
            amp = BLOB_AMP * float(rng.uniform(0.75, 1.15))
            sigma = BLOB_SIGMA * float(rng.uniform(0.9, 1.1))
            blob_profile(img, cx, cy, amp, sigma, rng)
            coords.append((cx, cy))
    # a few dark aggregates — the junk classes every real grid feeds class2d
    for _ in range(3):
        ax = float(rng.uniform(300, NX - 300))
        ay = float(rng.uniform(300, NY - 300))
        blob_profile(img, ax, ay, BLOB_AMP * 1.4, BLOB_SIGMA * 2.6, rng, sublobes=1)
    return img, coords


def main():
    os.makedirs(MIC_DIR, exist_ok=True)
    os.makedirs(COORD_DIR, exist_ok=True)
    for i, stem in enumerate(MICS, 1):
        mic_path = os.path.join(MIC_DIR, stem + ".mrc")
        coord_path = os.path.join(COORD_DIR, stem + ".coord")
        img, coords = make_mic(1000 + i)
        write_mrc(mic_path, NX, NY, 1, img)
        with open(coord_path, "w") as fh:
            for (cx, cy) in coords:
                fh.write(f"{cx:.1f} {cy:.1f}\n")
        sz = os.path.getsize(mic_path)
        print(f"[{i}/8] {stem}.mrc — {sz:,} bytes ({NX}×{NY}, 64 blobs + 3 aggregates)")
    print("EMPIAR-10017-style fixtures ready (cryo polarity: dark particles on positive ice)")


if __name__ == "__main__":
    main()
