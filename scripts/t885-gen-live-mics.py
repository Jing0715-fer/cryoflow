#!/usr/bin/env python3
"""t885 — the live-loop mic generator: four identical 512x512 blob-field
micrographs (seed 884, the t884 nine-centers flavor scaled x2, sigma 32).

The recipe is the probe's LIVE-SCOPE one (scripts/t885-fom-threshold-probe.py)
whose numbers the probe verified: the real autopick detects N=8 picks, 7 of
them inside the box-96 crop safe zone, and at --minimum_pick_fom 0.40 the
general FOM lane keeps 4 per micrograph while the trained lane keeps 7.
The instrument pins those numbers through the live app.

Usage: python3 scripts/t885-gen-live-mics.py <outdir>
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "services", "mock-cluster", "fs", "opt", "bin"))
import cf_cryo  # noqa: E402

NX = NY = 512
BLOBS = [(120, 100), (340, 140), (220, 260), (400, 340), (90, 400),
         (300, 440), (180, 60), (460, 220), (60, 220)]

out = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(884)
img = rng.normal(100.0, 14.0, (NY, NX))
yy, xx = np.mgrid[0:NY, 0:NX]
for (cx, cy) in BLOBS:
    r2 = (xx - cx) ** 2 + (yy - cy) ** 2
    img += (-98.0) * np.exp(-r2 / (2 * 32.0 ** 2))
for k in (1, 2, 3, 4):
    cf_cryo.write_mrc(os.path.join(out, f"live_0{k}.mrc"), NX, NY, 1,
                      img.astype(np.float32), angpix=1.77)
print("t885 live mics written:", out)
