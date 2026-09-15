#!/usr/bin/env python3
"""Task 219 — the TWIN: a third owner with the SAME landscape as the outlier.

t215's lens has a three-state comparator whose tie branch (a tie for the
crown is no crown) is pinned only by a source oracle — the bare world has
ONE outlier, so `outlierRowIdx` never faces a real tie on the wire. This
seeder builds that world: a NEW class2d job ("QA Class2D Twin") that owns
an orthovol BYTE-IDENTICAL to the outlier's divergent shape (same file,
same peak, same Δ vs the winner). The inventory then speaks THREE rows,
two of which contend for the amber crown with equal |Δ| — and the lens
must crown NEITHER.

Idempotent by name (re-run finds the twin and only re-copies the volume).
The probe that uses this world DELETES the twin on teardown (DELETE
/api/jobs/:id — clearRunRecord + edge cascade; the workdir on disk is
intentionally kept by the route's undo doctrine, and gc-orphans collects
it as a fossil on the next round).

Usage: python3 scripts/seed-twin.py [--clean]
  --clean deletes the twin job if present (the probe's teardown does this
  through the API; --clean is the offline path).
"""
import json
import os
import shutil
import struct
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import (  # noqa: E402
    api,
    find_by_name,
    job_workdir,
    list_jobs,
    register_engine_state,
    resolve_project,
    resolve_workspace,
)

BASE = "http://localhost:3000"
TWIN_NAME = "QA Class2D Twin"
OUTLIER_HOST = "QA Class2D Source"
VOL_NAME = "orthovol.mrc"


def api_h(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json", "Origin": BASE,
                 "sec-fetch-site": "same-origin"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def flip_completed(job_id, result):
    node = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const spec = JSON.parse(process.argv[1]);
Promise.all(spec.map(([id, result]) =>
  p.job.update({ where: { id }, data: { status: 'completed', progress: 100, result } }),
)).then(() => { console.log('flipped'); return p.$disconnect(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"""
    spec = json.dumps([[job_id, result]])
    r = subprocess.run(["node", "-e", node, spec],
                       cwd="/home/z/my-project", capture_output=True, text=True)
    if "flipped" not in r.stdout:
        sys.exit(f"flip failed: {r.stderr.strip()[:300]}")


def main():
    if "--clean" in sys.argv:
        twin = find_by_name(TWIN_NAME)
        if twin:
            api(f"/api/jobs/{twin['id']}", "DELETE")
            print(f"twin deleted: {twin['id']}")
        else:
            print("twin absent — nothing to clean")
        return

    project = resolve_project()
    workspace = resolve_workspace(project)

    # 1. the twin job (idempotent by name)
    jobs = list_jobs()
    twin = find_by_name(TWIN_NAME, jobs)
    if twin:
        print(f"twin (existing): {twin['id']}")
    else:
        r = api("/api/jobs", "POST", {"type": "class2d", "x": 880, "y": 560,
                                      "workspaceId": workspace})
        twin = r.get("job") or r
        api(f"/api/jobs/{twin['id']}", "PATCH", {"name": TWIN_NAME})
        flip_completed(twin["id"], "Twin landscape · 1 volume (byte-identical to the outlier's)")
        print(f"twin (created):  {twin['id']}")

    # 2. the divergent volume, byte-identical to the outlier's — copy, not
    #    re-derive (one shape, two owners: a re-derived shape is a SECOND
    #    father, and the tie must be EXACT for the crown to be contested)
    outlier = find_by_name(OUTLIER_HOST, jobs)
    if not outlier:
        sys.exit(f"outlier host '{OUTLIER_HOST}' missing — run seed-outlier first")
    src = os.path.join(job_workdir(project, outlier), VOL_NAME)
    if not os.path.exists(src):
        sys.exit(f"outlier volume missing at {src} — run seed-outlier first")
    wd = job_workdir(project, twin)
    os.makedirs(wd, exist_ok=True)
    dst = os.path.join(wd, VOL_NAME)
    shutil.copyfile(src, dst)
    same = open(src, "rb").read() == open(dst, "rb").read()
    print(f"volume: {dst} ({os.path.getsize(dst)} bytes, byte-identical={same})")

    # 3. the run record — outputs routes refuse jobs without one
    if register_engine_state(twin["id"], project, twin["type"], wd):
        print("run record: registered")
    else:
        print("run record: already present")

    # 4. the receipt the probe asserts on
    outs = api_h(f"/api/jobs/{twin['id']}/outputs")
    files = [f["name"] for f in (outs.get("files") or [])]
    print(f"TWIN_READY id={twin['id']} workdir={wd} outputs={files}")


if __name__ == "__main__":
    main()
