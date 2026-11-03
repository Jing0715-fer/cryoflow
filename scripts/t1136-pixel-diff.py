#!/usr/bin/env python3
"""t1136 — the pixel-diff helper: count differing pixels between two
screenshots inside a box (x y w h), print "COUNT <n>" (0 when the images
agree in the box). The A/B ride's arithmetic — one father, so the ride
and any re-ride read the same numbers."""
import sys
from PIL import Image, ImageChops

a_path, b_path = sys.argv[1], sys.argv[2]
x, y, w, h = (int(v) for v in sys.argv[3:7])
a = Image.open(a_path).convert("RGB").crop((x, y, x + w, y + h))
b = Image.open(b_path).convert("RGB").crop((x, y, x + w, y + h))
d = ImageChops.difference(a, b)
bbox = d.getbbox()
if bbox is None:
    print("COUNT 0")
    raise SystemExit(0)
n = sum(1 for px in d.getdata() if px != (0, 0, 0))
print(f"COUNT {n}")
