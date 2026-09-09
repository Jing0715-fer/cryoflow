#!/usr/bin/env python3
"""Task 66 E2E seed — a synthetic 3D volume with axis-drifting content, so
the orthogonal slice browser (map-ortho-panel) has something honest to show.

Writes orthovol.mrc into the workdir of the seeded Class2D source job
(qa58-seed-gallery.py's job — its results dialog lists every file in the
workdir, so the volume shows up as a normal map output and opens through
the standard "View in 3D (Mol*)" path).

Volume design (64³, mode 2 float32, nsymbt=0):
  a TUBE along z whose cross-section center DRIFTS with z
  (cx = 16 + 34·z/63, cy = 32) + a fixed 3D blob at (48, 16, 48).
  Consequences the QA asserts on:
  - z=0 vs z=1 XY planes differ strongly (tube cross-section at x=16 vs x=50)
  - y=0.2 vs y=0.8 XZ planes differ (tube vs fixed blob dominance)
  - x=0.5 YZ plane catches the trail crossing around z≈30

Usage: python3 scripts/qa67-seed-volume.py [--clean]
  --clean removes orthovol.mrc (idempotent reseed = overwrite).
"""
import json
import math
import struct
import sys
import urllib.request

BASE = "http://localhost:3000"
SRC_NAME = "QA Class2D Source"
VOL_NAME = "orthovol.mrc"
N = 64
SIGMA = 5.5


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        return json.loads(data) if data else {}


def find_workdir() -> tuple[str, str]:
    """engine-state.json top level maps job id → record with .workdir.
    Returns (job_id, workdir)."""
    jobs = api("/api/jobs")
    jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
    src = next((j for j in jobs if j.get("name") == SRC_NAME), None)
    if not src:
        raise SystemExit(f"FATAL: seed job '{SRC_NAME}' missing — run qa58-seed-gallery.py first")
    with open("data/engine-state.json", "r", encoding="utf-8") as f:
        state = json.load(f)
    rec = state.get(src["id"]) or {}
    wd = rec.get("workdir")
    if not wd:
        raise SystemExit(f"FATAL: no workdir registered for {SRC_NAME} ({src['id']})")
    return src["id"], wd


def blob(x, y, z, cx, cy, cz):
    return math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (2 * SIGMA * SIGMA))


def blob2d(x, y, cx, cy):
    return math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * SIGMA * SIGMA))


def build_volume():
    # data[z][y][x] — MRC sections stack along z, each section row-major x fastest
    vals = []
    for z in range(N):
        cx = 16 + 34 * (z / (N - 1))  # the drift — tube cross-section per z
        for y in range(N):
            for x in range(N):
                v = 0.9 * blob2d(x, y, cx, N / 2)      # drifting tube (in-section Gaussian)
                v += 0.6 * blob(x, y, z, 48, 16, 48)   # fixed 3D blob
                vals.append(v)
    return vals


def write_mrc(path, vals):
    nx = ny = nz = N
    # explicit-offset header assembly so every field position is auditable
    buf = bytearray(1024)
    def i32(off, v):
        struct.pack_into("<i", buf, off, v)
    def f32(off, v):
        struct.pack_into("<f", buf, off, v)
    i32(0, nx); i32(4, ny); i32(8, nz)
    i32(12, 2)                 # mode float32
    i32(16, 0); i32(20, 0); i32(24, 0)   # start
    i32(28, nx); i32(32, ny); i32(36, nz)  # mx my mz
    f32(40, 1.0); f32(44, 1.0); f32(48, 1.0)  # cella
    f32(52, 90.0); f32(56, 90.0); f32(60, 90.0)
    i32(64, 1); i32(68, 2); i32(72, 3)   # mapc mapr maps
    f32(76, 0.0); f32(80, max(vals)); f32(84, sum(vals) / len(vals))
    i32(88, 1)                 # ispg = 1 (orthorhombic volume, not a stack)
    i32(92, 0)                 # nsymbt
    buf[208:212] = b"MAP "
    struct.pack_into("<i", buf, 212, 16777214)  # little-endian float stamp
    with open(path, "wb") as f:
        f.write(bytes(buf))
        f.write(b"".join(struct.pack("<f", v) for v in vals))


def main():
    clean = "--clean" in sys.argv
    job_id, wd = find_workdir()
    target = f"{wd}/{VOL_NAME}"
    import os
    if clean:
        if os.path.exists(target):
            os.remove(target)
            print(f"cleaned: {target}")
        else:
            print("already clean")
        return
    print(f"workdir: {wd}")
    print("building 64³ drifting-blob volume …")
    vals = build_volume()
    write_mrc(target, vals)
    size = os.path.getsize(target)
    assert size == 1024 + N * N * N * 4, f"unexpected size {size}"
    print(f"written: {target} ({size} bytes)")
    # sanity through the app's own renderer (central z section); the file
    # route is same-origin guarded → scripts must present an Origin header
    req = urllib.request.Request(
        f"{BASE}/api/jobs/{job_id}/outputs/file?path={VOL_NAME}&format=png&axis=z&pos=0.5",
        headers={"Origin": BASE},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        png = r.read()
    assert r.status == 200 and png[:4] == b"\x89PNG" and len(png) > 500, "central slice render failed"
    print(f"verify: central XY slice renders ({len(png)} bytes png)")
    print("seed OK")


if __name__ == "__main__":
    main()
