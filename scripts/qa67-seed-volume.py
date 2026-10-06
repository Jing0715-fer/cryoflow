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

Host selection (QA_VOL_HOST env): by default the volume lands in the
Class2D tail-tier host (qa58's job); QA_VOL_HOST="QA Refine3D" retargets
the WINNER host (t204/t210's recipe — the inventory probes' food; their
setup and restore-gallery section 9 both call this variant explicitly).
The bare call and the QA_VOL_HOST variant write DIFFERENT hosts — a
recipe that runs only one of them leaves the other host volumeless.
"""
import json
import math
import os
import struct
import sys
import urllib.request

BASE = "http://localhost:3000"
# Task 107 — the target host is overridable: the legacy bookmark suites
# (qa42-45, 48) seed the same synthetic volume into the refine3d sandbox
# ("QA Refine3D") so their viewer entry chain finds an enlargeable tile.
SRC_NAME = os.environ.get("QA_VOL_HOST", "QA Class2D Source")
VOL_NAME = "orthovol.mrc"
N = 64
SIGMA = 5.5


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        # t259 doctrine: same-origin metadata for the metadata-door routes
        # (this local api() is outside the qa_lib single point).
        headers={"sec-fetch-site": "same-origin", "Origin": BASE, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        return json.loads(data) if data else {}


def find_workdir() -> tuple[str, str]:
    """engine-state.json top level maps job id → record with .workdir.
    Returns (job_id, workdir).

    t407 — the host resolves BY NAME first, then BY TYPE. The legacy names
    ("QA Refine3D", "QA Class2D Source") are gallery-furniture fossils from
    the restore-gallery world the 15-node roster cannot hold (the t405
    seesaw, first living case in t406's t241). The healed chain carries the
    SAME TYPES — refine3d for the QA_VOL_HOST="QA Refine3D" recipe, class2d
    for the default — completed, newest first. The seed promises "a volume
    lands in a job whose results dialog shows it", and the type is that
    promise; the name was only ever one world's spelling of it.

    t532 — /api/jobs is ACTIVE-POINTER-scoped (it returned the exam world's
    10 jobs while the demo world held 23), so the type fallback lies
    whenever another world is active. When the API scan finds no host, the
    OLD-WORLD MANIFEST (data/old-world.json, written by
    qa-t531-old-world-seed.mjs) is the cross-project contract: the chain's
    refine3d/class2d id resolves through engine-state.json as usual."""
    jobs = api("/api/jobs")
    jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
    src = next((j for j in jobs if j.get("name") == SRC_NAME), None)
    if not src:
        host_type = "refine3d" if "Refine3D" in SRC_NAME or "refine" in SRC_NAME.lower() else "class2d"
        done = [
            j for j in jobs
            if j.get("type") == host_type and j.get("status") == "completed"
        ]
        src = done[0] if done else None
        if src:
            print(f"note: '{SRC_NAME}' not found — seeding into the healed chain's "
                  f"completed {host_type} job '{src.get('name')}' ({src['id']})")
    if not src:
        # t532 — the manifest fallback (cross-project, active-pointer-immune)
        try:
            with open("data/old-world.json", "r", encoding="utf-8") as f:
                man = json.load(f)
            host_id = (man.get("chain") or {}).get(host_type)
            if host_id:
                print(f"note: no host in the active world — manifest fallback: "
                      f"old-world {host_type} {host_id} (project {man.get('project', {}).get('name')})")
                return host_id, None  # workdir resolved by the caller below
        except FileNotFoundError:
            pass
        raise SystemExit(
            f"FATAL: no seed host found — neither the gallery name '{SRC_NAME}' "
            f"nor a completed job of the matching type in this world (and no old-world manifest)"
        )
    with open("data/engine-state.json", "r", encoding="utf-8") as f:
        state = json.load(f)
    rec = state.get(src["id"]) or {}
    wd = rec.get("workdir")
    if not wd:
        raise SystemExit(f"FATAL: no workdir registered for {SRC_NAME} ({src['id']})")
    return src["id"], wd


def workdir_of(job_id: str) -> str:
    with open("data/engine-state.json", "r", encoding="utf-8") as f:
        state = json.load(f)
    wd = (state.get(job_id) or {}).get("workdir")
    if not wd:
        raise SystemExit(f"FATAL: no workdir registered for {job_id}")
    return wd


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
    # --take-home is a deliberate alias of --clean here (t630 rollout):
    # this seeder owns NO job rows — orthovol.mrc is a TENANT of the
    # qa58 pair's workdir. Its only take-home duty is the radius (remove
    # the volume so the landlord's --take-home sees a tenant-free
    # workdir and can pop its entry + delete its rows). Tenant BEFORE
    # host — the order is the iron law's second clause.
    clean = "--clean" in sys.argv or "--take-home" in sys.argv
    job_id, wd = find_workdir()
    if wd is None:  # manifest fallback — resolve through the ledger
        wd = workdir_of(job_id)
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
