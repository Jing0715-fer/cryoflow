#!/usr/bin/env python3
"""Synthesize a SECOND QA half-map (slightly different blob) for the
multi-map overlay QA — drop next to postprocess.mrc in the fixture workdir
as run_it001_half1_class001.mrc so the outputs route labels it "Half-map 1".

Header construction mirrors make-qa-map.py exactly (ispg=1, cellb=90°,
F-order data, "MAP " magic + machst + rms) — mol* rejects ispg=0/zero cell
angles ("bad axis order" / "Invalid typed array length: -Infinity").
"""
import struct
import sys

import numpy as np

OUT = sys.argv[1]
N = 40
PX = 1.77

z, y, x = np.mgrid[0:N, 0:N, 0:N].astype(np.float32)
blob = (
    np.exp(-((x - 22) ** 2 + (y - 18) ** 2 + (z - 19) ** 2) / (2 * 5.0**2)) * 0.9
    + np.exp(-((x - 14) ** 2 + (y - 26) ** 2 + (z - 22) ** 2) / (2 * 3.0**2)) * 0.55
).astype(np.float32)
blob -= np.exp(-((x - 24) ** 2 + (y - 14) ** 2 + (z - 26) ** 2) / (2 * 2.2**2)) * 0.2
blob = blob.astype(np.float32)

h = np.zeros(256, dtype=np.int32)
h[0], h[1], h[2] = N, N, N
h[3] = 2                      # mode 2 = float32
h[4], h[5], h[6] = 0, 0, 0    # start
h[7], h[8], h[9] = N, N, N    # mx, my, mz
h[16], h[17], h[18] = 1, 2, 3  # mapc/mapr/maps — mol* rejects other orders
h[22] = 1                     # ispg = P1 (0 breaks mol* grid → -Infinity)
h[23] = 0                     # nsymbt
h[52] = ord("M") | (ord("A") << 8) | (ord("P") << 16) | (ord(" ") << 24)
h[53] = 0x00004444            # machst "DD 44" (MRC2014)
h[55] = 0                     # nlabl

hf = h.view(np.float32)
hf[10], hf[11], hf[12] = PX * N, PX * N, PX * N  # cella (Å)
hf[13], hf[14], hf[15] = 90.0, 90.0, 90.0        # cellb
hf[19], hf[20], hf[21] = float(blob.min()), float(blob.max()), float(blob.mean())
hf[49], hf[50], hf[51] = 0.0, 0.0, 0.0           # origin
hf[54] = float(blob.std())                       # rms

header = h.tobytes()
assert len(header) == 1024

with open(OUT, "wb") as f:
    f.write(header)
    f.write(blob.tobytes(order="F"))  # x-fastest, per MRC convention

print(f"wrote {OUT}: {N}^3 float32, range [{blob.min():.3f}, {blob.max():.3f}]")
