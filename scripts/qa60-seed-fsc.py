#!/usr/bin/env python3
"""Task 60 E2E seed — three FSC-bearing jobs with REAL-shape curves on
DIFFERENT resolution grids, so the compare-FSC overlay dialog has a
three-way comparison to render (two postprocess corrected curves + one
refine3d gold-standard half-map curve).

Curve model (logistic, anchored to RELION conventions — same family as
qa50's seed, retargeted per job):
  curve(f) = 0.97/(1+exp((f-fm)/0.0226)) + 0.005
  → crosses 0.143 at fm + 1.7969*w  (w = 0.0226 → +0.0406)

  job            target    fm       grid (1/Å)      Nyquist
  QA Post 320    3.20 Å    0.2719   0.01–0.35 ×41   2.857 Å
  QA Post 385    3.85 Å    0.2191   0.01–0.30 ×31   3.333 Å
  QA Refine 410  4.10 Å    0.2033   0.01–0.28 ×24   3.571 Å

Distinct grids matter: the overlay merges shells from all curves onto a
UNION resolution axis with per-curve gap-bridging, so co-sampled points
would hide a broken merge.

Job skeleton follows qa58's convention: create via API (idempotent by
name), flip to completed straight in the DB (PATCH only allows idle),
hand-write the engine-state run record (a seeded job never went through
dispatch, and every workdir-reading route refuses jobs without one).

Usage: python3 scripts/qa60-seed-fsc.py [--clean]
  --clean removes the seeded star files + engine-state entries (jobs stay).
"""
import datetime
import json
import math
import os
import subprocess
import sys
import urllib.request

BASE = "http://localhost:3000"
PROJECT = "cmtrzp5x80002p8uofb9eu5pp"
WORKSPACE = "cmts0qohh0001p8dasv88cddv"
STATE_PATH = "/home/z/my-project/data/engine-state.json"
W = 0.0226
F0 = 0.01

# name, type, target resolution (Å), grid max freq, shell count, x, y
SPECS = [
    ("QA Post 300",   "postprocess", 3.00, 0.36, 45, 150, 980),
    ("QA Post 320",   "postprocess", 3.20, 0.35, 41, 150, 780),
    ("QA Post 385",   "postprocess", 3.85, 0.30, 31, 460, 780),
    ("QA Refine 410", "refine3d",    4.10, 0.28, 24, 770, 780),
]


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


def curve(f: float, fm: float) -> float:
    return 0.97 / (1.0 + math.exp((f - fm) / W)) + 0.005


def fm_for(target_a: float) -> float:
    return 1.0 / target_a - 1.7969 * W


def postprocess_star(fm: float, f1: float, n: int, target: float) -> str:
    import random
    rng = random.Random(int(target * 100))  # deterministic per job
    lines = [
        "data_general",
        "",
        "_rlnOptimisationSetOriginalHalfMap            Import/job004/half1_class001_unfil.mrc",
        "_rlnOptimisationSetOriginalHalfMap2           Import/job004/half2_class001_unfil.mrc",
        f"_rlnFinalResolution                           {target:.6f}",
        "_rlnUnfilteredMapHalf1                        postprocess_it020_half1_class001.mrc",
        "_rlnMaskName                                  mask_create/mask.mrc",
        "",
        "data_fsc",
        "",
        "loop_",
        "_rlnResolution #1",
        "_rlnAngstromResolution #2",
        "_rlnFourierShellCorrelationCorrected #3",
        "_rlnCorrectedFourierShellCorrelationPhaseRandomizedMaskedMaps #4",
        "_rlnFourierShellCorrelationUnmaskedMaps #5",
        "_rlnFourierShellCorrelationMaskedMaps #6",
    ]
    for i in range(n):
        f = F0 + (f1 - F0) * i / (n - 1)
        c = curve(f, fm)
        un = min(0.99, c * 1.04 + 0.01 + rng.uniform(-0.004, 0.004))
        ma = min(0.99, c * 1.12 + 0.02 + rng.uniform(-0.004, 0.004))
        ph = max(0.0, 0.008 + 0.06 * f + rng.uniform(-0.003, 0.003))
        ang = 999.0 if i == 0 else 1.0 / f  # RELION's 999 Å first-shell sentinel
        lines.append(f"{f:.9f}  {ang:9.6f}  {c:.6f}  {ph:.6f}  {un:.6f}  {ma:.6f}")
    return "\n".join(lines) + "\n"


def model_star(fm: float, f1: float, n: int) -> str:
    import random
    rng = random.Random(4100)  # deterministic
    lines = [
        "data_model_half1_class001",
        "",
        "loop_",
        "_rlnResolution #1",
        "_rlnAngstromResolution #2",
        "_rlnGoldStandardFsc #3",
    ]
    for i in range(n):
        f = F0 + (f1 - F0) * i / (n - 1)
        g = curve(f, fm) + rng.uniform(-0.003, 0.003)
        lines.append(f"{f:.9f}  {1.0 / f:9.6f}  {min(0.99, g):.6f}")
    return "\n".join(lines) + "\n"


def flip_status(job_id: str) -> None:
    mark = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.update({ where: { id: process.argv[1] }, data: { status: 'completed', progress: 100 } })
  .then(() => { console.log('completed'); return p.$disconnect(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"""
    r = subprocess.run(
        ["node", "-e", mark, job_id],
        cwd="/home/z/my-project", capture_output=True, text=True,
    )
    if "completed" not in r.stdout:
        sys.exit(f"DB status flip failed for {job_id}: {r.stderr.strip()[:200]}")


def register_run(job: dict, workdir: str) -> None:
    with open(STATE_PATH) as f:
        state = json.load(f)
    state[job["id"]] = {
        "jobId": job["id"],
        "projectId": PROJECT,
        "type": job["type"],
        "pid": None,
        "cmd": "qa-fixture (qa60-seed-fsc.py)",
        "workdir": workdir,
        "logFile": os.path.join(workdir, "run.out"),
        "errFile": os.path.join(workdir, "run.err"),
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "outputs": {},
        "done": True,
        "exitCode": 0,
    }
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def main() -> None:
    clean = "--clean" in sys.argv
    jobs = api("/api/jobs")
    jobs = jobs["jobs"] if isinstance(jobs, dict) else jobs
    created_files = []

    for name, jtype, target, f1, n, x, y in SPECS:
        job = next((j for j in jobs if j.get("name") == name), None)
        if job is None:
            r = api("/api/jobs", "POST", {"type": jtype, "x": x, "y": y, "workspaceId": WORKSPACE})
            job = r.get("job") or r
            api(f"/api/jobs/{job['id']}", "PATCH", {"name": name})
            print(f"{jtype} (created): {job['id']}")
        else:
            print(f"{jtype} (existing): {job['id']}")

        workdir = os.path.join(
            "/home/z/my-project/data/relion", PROJECT, f"{jtype}_{job['id'][-8:]}"
        )
        fname = "postprocess.star" if jtype == "postprocess" else "run_half1_model.star"
        fpath = os.path.join(workdir, fname)

        if clean:
            if os.path.exists(fpath):
                os.remove(fpath)
                print(f"clean: removed {fname}")
            try:
                with open(STATE_PATH) as f:
                    state = json.load(f)
                if state.pop(job["id"], None) is not None:
                    with open(STATE_PATH, "w") as f:
                        json.dump(state, f, indent=2)
                    print(f"clean: engine-state entry popped for {name}")
            except Exception as e:
                print(f"clean: state pop failed for {name} ({e})")
            continue

        os.makedirs(workdir, exist_ok=True)
        fm = fm_for(target)
        if jtype == "postprocess":
            content = postprocess_star(fm, f1, n, target)
        else:
            content = model_star(fm, f1, n)
        with open(fpath, "w") as fh:
            fh.write(content)
        created_files.append(fpath)

        flip_status(job["id"])
        register_run(job, workdir)
        f_cross = fm + 1.7969 * W
        print(f"  seeded {fname} → 0.143 @ ~{1.0 / f_cross:.2f} Å (target {target})")

    if not clean:
        # verify through the app's own API — the index must discover all three
        idx = api(f"/api/projects/{PROJECT}/fsc-index")
        names = {j["name"] for j in idx.get("jobs", [])}
        missing = {s[0] for s in SPECS} - names
        if missing:
            sys.exit(f"seed verification FAILED — index missing: {missing}")
        print(f"index verified: {len(idx['jobs'])} FSC jobs, seeded names all present")


if __name__ == "__main__":
    main()
