#!/usr/bin/env python3
"""Synthesize a small CCP4/MRC2014 map (3D Gaussian blob) for 3D-viewer QA.

Strict MRC2014 header (mol* ParseCcp4 validates the "MAP " magic at byte
208 — CryoFlow's own mrc.ts is lenient, mol* is not):
  words 0-based: 0-2 nx/ny/nz · 3 mode · 4-6 start · 7-9 mx/my/mz ·
  10-12 cella · 13-15 cellb · 16-18 mapc/r/s · 19-21 dmin/dmax/dmean (f32) ·
  22 ispg · 23 nsymbt · 49-51 origin (f32) · 52 "MAP " · 53 machst ·
  54 rms (f32) · 55 nlabl · 56+ labels
"""
import struct
import sys
import numpy as np

OUT = sys.argv[1]
N = 40
PX = 1.77

z, y, x = np.mgrid[0:N, 0:N, 0:N].astype(np.float32)
blob = (
    np.exp(-((x - 20) ** 2 + (y - 20) ** 2 + (z - 20) ** 2) / (2 * 6.0**2)) * 1.0
    + np.exp(-((x - 12) ** 2 + (y - 24) ** 2 + (z - 18) ** 2) / (2 * 3.5**2)) * 0.6
    + np.exp(-((x - 28) ** 2 + (y - 14) ** 2 + (z - 24) ** 2) / (2 * 3.0**2)) * 0.5
).astype(np.float32)
# tiny negative pocket so the inverted-side flip has something to show
blob -= np.exp(-((x - 20) ** 2 + (y - 12) ** 2 + (z - 28) ** 2) / (2 * 2.0**2)) * 0.25
blob = blob.astype(np.float32)

h = np.zeros(256, dtype=np.int32)
h[0], h[1], h[2] = N, N, N
h[3] = 2                      # mode 2 = float32
h[4], h[5], h[6] = 0, 0, 0    # start
h[7], h[8], h[9] = N, N, N    # mx, my, mz
h[16], h[17], h[18] = 1, 2, 3 # mapc, mapr, maps (mol* rejects other orders)
# cella/cellb are FLOAT words — int writes would bit-reinterpret as ~1e-44
# floats and collapse mol*'s unit cell (fromFractional → all zeros)
h[22] = 1                     # ispg = P1
h[23] = 0                     # nsymbt
h[52] = ord("M") | (ord("A") << 8) | (ord("P") << 16) | (ord(" ") << 24)  # MAP
h[53] = 0x00004444            # machst "DD 44" (MRC2014)
h[55] = 0                     # nlabl

# float32 words layered over the same 1024-byte header
hf = h.view(np.float32)
hf[10], hf[11], hf[12] = PX * N, PX * N, PX * N  # cella (Å)
hf[13], hf[14], hf[15] = 90.0, 90.0, 90.0        # cellb
hf[19], hf[20], hf[21] = float(blob.min()), float(blob.max()), float(blob.mean())
hf[49], hf[50], hf[51] = 0.0, 0.0, 0.0  # origin
hf[54] = float(blob.std())              # rms

header = h.tobytes()
assert len(header) == 1024

with open(OUT, "wb") as f:
    f.write(header)
    f.write(blob.tobytes(order="F"))  # x-fastest

print(f"wrote {OUT}: {N}^3 float32, range [{blob.min():.3f}, {blob.max():.3f}]")
