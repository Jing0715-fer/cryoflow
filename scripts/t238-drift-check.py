#!/usr/bin/env python3
"""t238 drift check — the family re-shots vs HEAD. The echo's narrow door
is export-only CSS (the app dialog is untouched), so any drift in the
app-side frames must be time-words / honest progress, not structure.
Strong-pixel band profile per frame (the standing forensic recipe)."""
import subprocess, sys
from PIL import Image, ImageChops

frames = [
    "scripts/shots-t210/t210-final-2x.png",
    "scripts/shots-t210/t210-lanes-2x.png",
    "scripts/shots-t210/t210-legend-open-2x.png",
    "scripts/shots-t212/t212-inventory-2x.png",
    "scripts/shots-t213/t213-doors-2x.png",
    "scripts/shots-t214/t214-peaks-2x.png",
    "scripts/shots-t215/t215-lens-2x.png",
]
for f in frames:
    old_bytes = subprocess.run(["git", "show", f"HEAD:{f}"], capture_output=True).stdout
    if not old_bytes:
        print(f"{f}: no HEAD version"); continue
    import io
    old = Image.open(io.BytesIO(old_bytes)).convert("RGB")
    new = Image.open(f).convert("RGB")
    if old.size != new.size:
        print(f"{f}: SIZE CHANGE {old.size} -> {new.size}"); continue
    diff = ImageChops.difference(old, new).convert("L")
    px = diff.load()
    w, h = diff.size
    strong = sum(1 for y in range(0, h, 2) for x in range(0, w, 2) if px[x, y] > 40)
    # band profile: which horizontal strips hold the strong pixels
    bands = {}
    for y in range(0, h, 2):
        row = sum(1 for x in range(0, w, 2) if px[x, y] > 40)
        if row > 8:
            bands[y // 40] = bands.get(y // 40, 0) + row
    top = sorted(bands.items(), key=lambda kv: -kv[1])[:4]
    total = (w // 2) * (h // 2)
    print(f"{f}: strong {strong} ({strong / total:.4f}) bands(y40-blocks) {[(k * 40, v) for k, v in top]}")
