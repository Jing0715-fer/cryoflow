#!/usr/bin/env python3
"""Task 215 e2e seed — the DIVERGENT second owner.

t214 made the Session map inventory comparable (the Peak column); t215
makes the comparison speak (the Δ winner column + the amber outlier
lens).  For the lens to be alive, the world must hold an owner whose
mass concentrates somewhere ELSE than the winner's — in the tie world
(both owners drinking the same qa67 shape, peak 76.2% of depth) the
honest lens can only say +0.0 everywhere and stay silent.

So this seeder overwrites the TAIL-TIER host's orthovol.mrc (QA
Class2D Source — qa67-seed-volume.py's default host) with the SAME
drifting-tube design but the fixed 3D blob moved from z=48 (76.2% of
depth) to z=16 (25.4% of depth).  The file NAME is untouched — every
label pin in the front-wave probes stays true; only the landscape
under the number moves.  The winner (QA Refine3D, seeded by
seed-refine-halves.py) is never touched.

Run AFTER qa67-seed-volume.py (it writes the same path; qa67's shape
would clobber this one).  Idempotent: writes the same bytes each run.

Usage: python3 scripts/seed-outlier.py [--clean]
  --clean restores the ORIGINAL qa67 shape (blob z=48) — the honest
  "undo my divergence" (removing the file would kill the owner, and
  the roster must keep its two rows).
"""
import json
import math
import os
import struct
import sys
import urllib.request

BASE = "http://localhost:3000"
SRC_NAME = os.environ.get("QA_VOL_HOST", "QA Class2D Source")
VOL_NAME = "orthovol.mrc"
N = 64
SIGMA = 5.5
BLOB_Z_T215 = 16  # the divergence: 16/63 of depth ≈ 25.4%
BLOB_Z_QA67 = 48  # the original: 48/63 of depth ≈ 76.2%


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
    jobs = api("/api/jobs")
    jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
    src = next((j for j in jobs if j.get("name") == SRC_NAME), None)
    if not src:
        raise SystemExit(
            f"FATAL: seed job '{SRC_NAME}' missing — restore the sandbox with scripts/restore-gallery.py first"
        )
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


def build_volume(blob_z):
    # qa67's exact design, one dial turned: where the fixed blob sits on z
    vals = []
    for z in range(N):
        cx = 16 + 34 * (z / (N - 1))
        for y in range(N):
            for x in range(N):
                v = 0.9 * blob2d(x, y, cx, N / 2)
                v += 0.6 * blob(x, y, z, 48, 16, blob_z)
                vals.append(v)
    return vals


def write_mrc(path, vals):
    nx = ny = nz = N
    buf = bytearray(1024)
    def i32(off, v):
        struct.pack_into("<i", buf, off, v)
    def f32(off, v):
        struct.pack_into("<f", buf, off, v)
    i32(0, nx); i32(4, ny); i32(8, nz)
    i32(12, 2)
    i32(16, 0); i32(20, 0); i32(24, 0)
    i32(28, nx); i32(32, ny); i32(36, nz)
    f32(40, 1.0); f32(44, 1.0); f32(48, 1.0)
    f32(52, 90.0); f32(56, 90.0); f32(60, 90.0)
    i32(64, 1); i32(68, 2); i32(72, 3)
    f32(76, 0.0); f32(80, max(vals)); f32(84, sum(vals) / len(vals))
    i32(88, 1)
    i32(92, 0)
    buf[208:212] = b"MAP "
    struct.pack_into("<i", buf, 212, 16777214)
    with open(path, "wb") as f:
        f.write(bytes(buf))
        f.write(b"".join(struct.pack("<f", v) for v in vals))


def main():
    clean = "--clean" in sys.argv
    job_id, wd = find_workdir()
    target = f"{wd}/{VOL_NAME}"
    blob_z = BLOB_Z_QA67 if clean else BLOB_Z_T215
    mode = "restoring original qa67 shape (blob z=48)" if clean else "writing DIVERGENT shape (blob z=16)"
    print(f"workdir: {wd}")
    print(f"{mode} …")
    vals = build_volume(blob_z)
    write_mrc(target, vals)
    print(f"seeded: {target} ({os.path.getsize(target)} bytes)")


if __name__ == "__main__":
    main()
