#!/usr/bin/env python3
"""Task 58 E2E seed — a completed Class2D → Select2D chain with a real
class-averages stack, so the selection gallery (and its new inspection
lightbox) renders inside the select2d job's parameter panel.

Writes into the workdir the /api/jobs/[id]/classes route computes for a
non-engine job:  data/relion/<projectId>/class2d_<id-suffix8>/
  run_it012_data.star                 — 1455 particle rows, 8 classes
      [420, 300, 240, 180, 120, 90, 60, 45]
      → auto mode (cutoff 0.5) keeps classes 1–3 (0.5 × 420 = 210)
  run_it012_unmasked_classes.mrcs     — MRC2014-style stack, 64×64×8,
      mode 2 float32, every slice a DISTINCT synthetic average so the
      lightbox visibly changes on ← / → navigation

Jobs are created idempotently by name ("QA Class2D Source" / "QA Class
Select"), wired classAverages→classes, and flipped to completed directly
in the DB (PATCH only allows status:"idle" — same approach the engine
uses: the row is the source of truth for status, the workdir for output).

Usage: python3 scripts/qa58-seed-gallery.py [--clean]
  --clean removes the seeded workdir files (jobs/edge stay — harmless).
"""
import json
import os
import struct
import sys
import urllib.request

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import read_engine_state, resolve_project, resolve_workspace

BASE = "http://localhost:3000"
PROJECT = resolve_project()
WORKSPACE = resolve_workspace(PROJECT)
SRC_NAME = "QA Class2D Source"
SEL_NAME = "QA Class Select"

# occupancy ladder — 8 classes, 1455 particles, occupancy DECOUPLED from
# class number so the gallery's occupancy sort genuinely reorders (and the
# auto cutoff still draws a 3-kept line):
#   cls:      1    2    3    4    5   6    7   8
#   count:  180  420   90  300   60 240   45 120
#   rank:     4    1    6    2    7   3    8   5
#   auto (0.5 × 420 = 210) keeps classes 2, 4, 6 → 960 / 1455 (66%)
COUNTS = [180, 420, 90, 300, 60, 240, 45, 120]
ITER = 12


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        return json.loads(data) if data else {}


# ---------------- jobs (idempotent by name) ----------------
jobs = api("/api/jobs")
jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs

def find_by_name(name):
    return next((j for j in jobs if j.get("name") == name), None)

src = find_by_name(SRC_NAME)
if src:
    print(f"class2d (existing): {src['id']}")
else:
    r = api("/api/jobs", "POST", {"type": "class2d", "x": 1050, "y": 780, "workspaceId": WORKSPACE})
    src = r.get("job") or r
    api("/api/jobs/" + src["id"], "PATCH", {"name": SRC_NAME})
    print(f"class2d (created):  {src['id']}")

sel = find_by_name(SEL_NAME)
if sel:
    print(f"select2d (existing): {sel['id']}")
else:
    r = api("/api/jobs", "POST", {"type": "select2d", "x": 1310, "y": 780, "workspaceId": WORKSPACE})
    sel = r.get("job") or r
    api("/api/jobs/" + sel["id"], "PATCH", {"name": SEL_NAME})
    print(f"select2d (created):  {sel['id']}")

# ---------------- edge classAverages → classes ----------------
edges = api("/api/edges")
edges = edges["edges"] if isinstance(edges, dict) else edges
already = any(
    e.get("fromJobId") == src["id"] and e.get("toJobId") == sel["id"] for e in edges
)
if not already:
    api("/api/edges", "POST", {
        "fromJobId": src["id"],
        "toJobId": sel["id"],
        "fromPort": "classAverages",
        "toPort": "classes",
    })
    print("edge: created (classAverages → classes)")
else:
    print("edge: exists")

# ---------------- flip statuses straight in the DB ----------------
mark = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
// the SOURCE class2d must be completed (the gallery only renders for a
// finished upstream run) — but the select2d host stays IDLE on purpose:
// card-click on a completed job opens the large inspector modal, while
// the parameter panel (which hosts the gallery) is the idle-job flow —
// exactly the real-world state: you pick classes, THEN run the select job
Promise.all([
  p.job.update({ where: { id: process.argv[1] }, data: { status: 'completed', progress: 100 } }),
  p.job.update({ where: { id: process.argv[2] }, data: { status: 'idle', progress: 0 } }),
]).then(() => { console.log('completed'); return p.$disconnect(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"""
import subprocess
r = subprocess.run(
    ["node", "-e", mark, src["id"], sel["id"]],
    cwd="/home/z/my-project", capture_output=True, text=True,
)
if "completed" not in r.stdout:
    sys.exit(f"DB status flip failed: {r.stderr.strip()[:200]}")
print("status: both completed")

# ---------------- reset the host's selection state ----------------
# a previous QA run may have left selectedClasses as a manual list (a FATAL
# exit skips the harness's own restore) — the gallery must boot in auto
try:
    api(f"/api/jobs/{sel['id']}", "PATCH", {"params": {"selectedClasses": "auto"}})
    print("params: selectedClasses reset to auto")
except Exception as e:
    sys.exit(f"params reset failed: {e}")

# ---------------- workdir ----------------
workdir = os.path.join(
    "/home/z/my-project/data/relion", PROJECT, f"class2d_{src['id'][-8:]}"
)
os.makedirs(workdir, exist_ok=True)
star_path = os.path.join(workdir, f"run_it{ITER:03d}_data.star")
mrcs_path = os.path.join(workdir, f"run_it{ITER:03d}_unmasked_classes.mrcs")

# register an engine run record — /api/jobs/<id>/outputs/file (the thumbnail
# + lightbox image source) refuses to serve anything without one
# ("No on-disk outputs for this job"), and a seeded job never went through
# dispatch, so the record must be written by hand, exactly what the engine
# does for a real run
state_path = "/home/z/my-project/data/engine-state.json"
state = read_engine_state()  # fresh-world safe: {} when the file doesn't exist yet
import datetime
state[src["id"]] = {
    "jobId": src["id"],
    "projectId": PROJECT,
    "type": "class2d",
    "pid": None,
    "cmd": "qa-fixture (qa58-seed-gallery.py)",
    "workdir": workdir,
    "logFile": os.path.join(workdir, "run.out"),
    "errFile": os.path.join(workdir, "run.err"),
    "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "outputs": {},
    "done": True,
    "exitCode": 0,
}
with open(state_path, "w") as f:
    json.dump(state, f, indent=2)
print(f"run record: registered for {src['id']} → {workdir}")

if "--clean" in sys.argv:
    removed = []
    for p in (star_path, mrcs_path):
        if os.path.exists(p):
            os.remove(p)
            removed.append(os.path.basename(p))
    # drop the engine run record too — the seeded job forgets its outputs
    try:
        with open(state_path) as f:
            state = json.load(f)
        if state.pop(src["id"], None) is not None:
            with open(state_path, "w") as f:
                json.dump(state, f, indent=2)
            removed.append("engine-state entry")
    except Exception as e:
        print(f"clean: state pop failed ({e})")
    # the classes route 404s-by-empty when the workdir vanishes entirely —
    # keep the directory itself so a stale job never turns into a 500
    print(f"clean: removed {removed or 'nothing'}")
    sys.exit(0)

# ---- run_it012_data.star — particle→class assignment (1455 rows) ----
lines = [
    "data_images",
    "",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
]
row = 1
for cls, n in enumerate(COUNTS, start=1):
    for _ in range(n):
        lines.append(f"{row:07d}@particles.star  {cls}")
        row += 1
with open(star_path, "w") as f:
    f.write("\n".join(lines) + "\n")
print(f"star: {star_path} ({row - 1} rows)")

# ---- run_it012_unmasked_classes.mrcs — 64×64×8 float32 stack ----
N = 64
import math

def grid():
    return [[0.0] * N for _ in range(N)]

def add_gaussian(g, cy, cx, amp, sigma):
    for y in range(N):
        for x in range(N):
            g[y][x] += amp * math.exp(-((y - cy) ** 2 + (x - cx) ** 2) / (2 * sigma * sigma))

def add_ring(g, cy, cx, r, amp, thick):
    for y in range(N):
        for x in range(N):
            d = math.hypot(y - cy, x - cx)
            if abs(d - r) < thick:
                g[y][x] += amp * (1.0 - abs(d - r) / thick)

def add_rod(g, y0, y1, x0, x1, amp, w):
    steps = max(abs(y1 - y0), abs(x1 - x0), 1)
    for i in range(steps + 1):
        cy = y0 + (y1 - y0) * i / steps
        cx = x0 + (x1 - x0) * i / steps
        add_gaussian(g, cy, cx, amp, w)

rng_state = 1234
def rnd():
    global rng_state
    rng_state = (1103515245 * rng_state + 12345) % (2**31)
    return rng_state / 2**31

slices = []
# cls 1 — bright donut (the "good" particle)
g = grid(); add_ring(g, 32, 32, 18, 1.0, 4.5); add_gaussian(g, 32, 32, 0.25, 4.0)
slices.append(g)
# cls 2 — horizontal rod
g = grid(); add_rod(g, 32, 32, 10, 54, 1.0, 4.0)
slices.append(g)
# cls 3 — dimer (two blobs)
g = grid(); add_gaussian(g, 24, 22, 0.9, 6.0); add_gaussian(g, 40, 42, 0.9, 6.0)
slices.append(g)
# cls 4 — diagonal streak
g = grid(); add_rod(g, 12, 52, 12, 52, 0.85, 3.5)
slices.append(g)
# cls 5 — crescent (arc off-center)
g = grid()
for a in range(-60, 61, 2):
    t = math.radians(a)
    add_gaussian(g, 34 + 16 * math.sin(t), 30 + 16 * math.cos(t), 0.10, 2.2)
slices.append(g)
# cls 6 — speckle noise
g = grid()
for y in range(N):
    for x in range(N):
        if rnd() > 0.86:
            g[y][x] += 0.55 + 0.4 * rnd()
slices.append(g)
# cls 7 — off-center blob + faint tail
g = grid(); add_gaussian(g, 40, 24, 0.95, 5.0); add_rod(g, 40, 18, 24, 44, 0.28, 2.5)
slices.append(g)
# cls 8 — near-empty (tiny faint dot)
g = grid(); add_gaussian(g, 32, 32, 0.30, 1.6)
slices.append(g)

flat = [v for sl in slices for row_ in sl for v in row_]
dmin, dmax = min(flat), max(flat)

hdr = bytearray(1024)
struct.pack_into("<3i", hdr, 0, N, N, len(slices))   # nx ny nz
struct.pack_into("<i", hdr, 12, 2)                    # mode 2 = float32
struct.pack_into("<3i", hdr, 28, N, N, len(slices))   # mx my mz
struct.pack_into("<3f", hdr, 40, 1.77 * N, 1.77 * N, 1.77 * N)  # cella
struct.pack_into("<3f", hdr, 52, 90.0, 90.0, 90.0)    # cellb
struct.pack_into("<3i", hdr, 64, 1, 2, 3)             # mapc mapr maps
struct.pack_into("<2f", hdr, 76, dmin, dmax)          # dmin dmax
struct.pack_into("<f", hdr, 84, sum(flat) / len(flat))  # dmean
struct.pack_into("<i", hdr, 92, 0)                    # nsymbt
hdr[208:212] = b"MAP "
hdr[212:214] = b"DD"
with open(mrcs_path, "wb") as f:
    f.write(hdr)
    for sl in slices:
        f.write(struct.pack(f"<{N * N}f", *[v for row_ in sl for v in row_]))
print(f"mrcs: {mrcs_path} ({len(slices)} slices, {os.path.getsize(mrcs_path)} bytes)")

# ---------------- verify through the app's own API ----------------
try:
    cls = api(f"/api/jobs/{src['id']}/classes")
    n_cls = len(cls.get("classes", []))
    print(f"verify: /classes → {n_cls} classes, total {cls.get('total')}, "
          f"iter {cls.get('iteration')}, file {cls.get('classesFile')}")
    if n_cls != len(COUNTS):
        sys.exit(f"VERIFY FAIL: expected {len(COUNTS)} classes, got {n_cls}")
except SystemExit:
    raise
except Exception as e:
    sys.exit(f"verify failed: {e}")
print("seed OK")
