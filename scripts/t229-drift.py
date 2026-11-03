#!/usr/bin/env python3
"""t229 drift archaeology: classify every modified frame against HEAD.
Strong-pixel diff (threshold 24) + bounding box + row profile — the
established recipe: sparse slivers = rendering truth, committed per the
t226 precedent; canvas noise (t210) = named checkout."""
import subprocess, sys
from PIL import Image, ImageChops

frames = [f for f in subprocess.run(
    ["git", "diff", "--name-only"],
    capture_output=True, text=True, cwd="/home/z/my-project",
).stdout.split() if f.endswith(".png")]

for f in frames:
    head = subprocess.run(["git", "show", f"HEAD:{f}"], capture_output=True, cwd="/home/z/my-project")
    if head.returncode != 0:
        print(f"{f}: NEW FILE"); continue
    import io, os
    a = Image.open(io.BytesIO(head.stdout)).convert("L")
    b = Image.open(f"/home/z/my-project/{f}").convert("L")
    if a.size != b.size:
        print(f"{f}: SIZE CHANGE {a.size} -> {b.size}"); continue
    diff = ImageChops.difference(a, b)
    px = diff.load()
    w, h = diff.size
    strong = [(x, y) for y in range(h) for x in range(w) if px[x, y] > 24]
    if not strong:
        print(f"{f}: identical"); continue
    xs = [p[0] for p in strong]; ys = [p[1] for p in strong]
    box = (min(xs), min(ys), max(xs), max(ys))
    dens = len(strong) / max(1, (box[2]-box[0]+1) * (box[3]-box[1]+1))
    print(f"{f}: strong={len(strong)} box={box} density={dens:.3f}")
